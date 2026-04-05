/**
 * HTTP API for DURANDAL integration.
 *
 * Exposes NanoClaw's container execution engine over HTTP so that
 * Hermes (the AI brain) can submit tasks without a messaging channel.
 */
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

import { GROUPS_DIR, ASSISTANT_NAME } from './config.js';
import {
  ContainerOutput,
  runContainerAgent,
  writeGroupsSnapshot,
  writeTasksSnapshot,
} from './container-runner.js';
import {
  createTask,
  deleteTask,
  getAllTasks,
  getTaskById,
} from './db.js';
import { resolveGroupFolderPath } from './group-folder.js';
import { logger } from './logger.js';
import { RegisteredGroup, ScheduledTask } from './types.js';

const DURANDAL_GROUP_FOLDER = 'durandal-tasks';
const DURANDAL_CHAT_JID = 'durandal:hermes';
const API_PORT = parseInt(process.env.DURANDAL_API_PORT || '7777', 10);

/**
 * Bearer token authentication middleware.
 * Requires the DURANDAL_API_TOKEN environment variable to be set.
 * If no token is configured, all requests are rejected with 503.
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.DURANDAL_API_TOKEN;
  if (!token) {
    res.status(503).json({
      error: 'API token not configured. Set DURANDAL_API_TOKEN env var.',
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const provided = authHeader.slice(7);
  // Constant-time comparison to prevent timing attacks
  if (
    provided.length !== token.length ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token))
  ) {
    res.status(403).json({ error: 'Invalid API token' });
    return;
  }

  next();
}

/**
 * Ensure the durandal-tasks group folder exists on disk.
 * Called at startup so API-initiated tasks have a working directory.
 */
function ensureDurandalGroup(): void {
  try {
    const groupDir = resolveGroupFolderPath(DURANDAL_GROUP_FOLDER);
    fs.mkdirSync(path.join(groupDir, 'logs'), { recursive: true });

    // Copy CLAUDE.md template if missing (use global template)
    const groupMdFile = path.join(groupDir, 'CLAUDE.md');
    if (!fs.existsSync(groupMdFile)) {
      const templateFile = path.join(GROUPS_DIR, 'global', 'CLAUDE.md');
      if (fs.existsSync(templateFile)) {
        let content = fs.readFileSync(templateFile, 'utf-8');
        if (ASSISTANT_NAME !== 'Andy') {
          content = content.replace(/^# Andy$/m, `# ${ASSISTANT_NAME}`);
          content = content.replace(
            /You are Andy/g,
            `You are ${ASSISTANT_NAME}`,
          );
        }
        fs.writeFileSync(groupMdFile, content);
        logger.info(
          { folder: DURANDAL_GROUP_FOLDER },
          'Created CLAUDE.md from template for DURANDAL group',
        );
      }
    }

    logger.info(
      { folder: DURANDAL_GROUP_FOLDER },
      'DURANDAL group folder ensured',
    );
  } catch (err) {
    logger.error(
      { err, folder: DURANDAL_GROUP_FOLDER },
      'Failed to create DURANDAL group folder',
    );
  }
}

/**
 * Build a RegisteredGroup for API-initiated tasks.
 */
function makeDurandalGroup(groupFolder?: string): RegisteredGroup {
  const folder = groupFolder || DURANDAL_GROUP_FOLDER;
  return {
    name: `DURANDAL (${folder})`,
    folder,
    trigger: '@durandal',
    added_at: new Date().toISOString(),
    requiresTrigger: false,
    isMain: false,
  };
}

/**
 * Start the HTTP API server.
 * Returns a Promise that resolves once the server is listening.
 */
export function startApiServer(): Promise<void> {
  ensureDurandalGroup();

  const app = express();
  app.use(express.json());

  // --- Health check (no auth) ---
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', service: 'nanoclaw' });
  });

  // --- All /api/* routes require auth ---
  app.use('/api', authMiddleware);

  // --- POST /api/execute ---
  app.post('/api/execute', async (req: Request, res: Response) => {
    const { prompt, sessionId, groupFolder } = req.body as {
      prompt?: string;
      sessionId?: string;
      groupFolder?: string;
    };

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required and must be a string' });
      return;
    }

    const folder = groupFolder || DURANDAL_GROUP_FOLDER;
    const group = makeDurandalGroup(folder);

    // Ensure the group folder exists
    try {
      const groupDir = resolveGroupFolderPath(folder);
      fs.mkdirSync(path.join(groupDir, 'logs'), { recursive: true });
    } catch (err) {
      res.status(400).json({
        error: `Invalid group folder: ${folder}`,
        details: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Write snapshots for the container
    const tasks = getAllTasks();
    writeTasksSnapshot(
      folder,
      false,
      tasks.map((t) => ({
        id: t.id,
        groupFolder: t.group_folder,
        prompt: t.prompt,
        script: t.script || undefined,
        schedule_type: t.schedule_type,
        schedule_value: t.schedule_value,
        status: t.status,
        next_run: t.next_run,
      })),
    );
    writeGroupsSnapshot(folder, false, [], new Set());

    logger.info(
      { folder, promptLength: prompt.length },
      'API execute request received',
    );

    try {
      const results: ContainerOutput[] = [];

      const output = await runContainerAgent(
        group,
        {
          prompt,
          sessionId,
          groupFolder: folder,
          chatJid: DURANDAL_CHAT_JID,
          isMain: false,
          assistantName: ASSISTANT_NAME,
        },
        // onProcess: we don't track processes for API calls (no GroupQueue)
        () => {},
        // onOutput: collect streamed results
        async (result: ContainerOutput) => {
          results.push(result);
        },
      );

      // Combine all streamed results
      const combinedResult = results
        .filter((r) => r.result)
        .map((r) =>
          typeof r.result === 'string'
            ? r.result
            : JSON.stringify(r.result),
        )
        .join('\n');

      res.json({
        status: output.status,
        result: combinedResult || output.result,
        sessionId: output.newSessionId || sessionId,
        error: output.error,
      });
    } catch (err) {
      logger.error({ err, folder }, 'API execute error');
      res.status(500).json({
        status: 'error',
        result: null,
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // --- GET /api/tasks ---
  app.get('/api/tasks', (_req: Request, res: Response) => {
    const tasks = getAllTasks();
    res.json({ tasks });
  });

  // --- POST /api/tasks ---
  app.post('/api/tasks', (req: Request, res: Response) => {
    const {
      prompt,
      script,
      groupFolder,
      scheduleType,
      scheduleValue,
      contextMode,
    } = req.body as {
      prompt?: string;
      script?: string;
      groupFolder?: string;
      scheduleType?: string;
      scheduleValue?: string;
      contextMode?: string;
    };

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }
    if (
      !scheduleType ||
      !['cron', 'interval', 'once'].includes(scheduleType)
    ) {
      res.status(400).json({
        error: 'scheduleType is required and must be one of: cron, interval, once',
      });
      return;
    }
    if (!scheduleValue || typeof scheduleValue !== 'string') {
      res.status(400).json({ error: 'scheduleValue is required' });
      return;
    }

    const folder = groupFolder || DURANDAL_GROUP_FOLDER;
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Compute next_run based on schedule type
    let nextRun: string | null = null;
    if (scheduleType === 'once') {
      nextRun = scheduleValue; // ISO date string
    } else if (scheduleType === 'interval') {
      const ms = parseInt(scheduleValue, 10);
      if (!isNaN(ms)) {
        nextRun = new Date(Date.now() + ms).toISOString();
      }
    } else if (scheduleType === 'cron') {
      // Let the scheduler compute the next run from the cron expression
      nextRun = now;
    }

    const task: Omit<ScheduledTask, 'last_run' | 'last_result'> = {
      id: taskId,
      group_folder: folder,
      chat_jid: DURANDAL_CHAT_JID,
      prompt,
      script: script || null,
      schedule_type: scheduleType as 'cron' | 'interval' | 'once',
      schedule_value: scheduleValue,
      context_mode: (contextMode as 'group' | 'isolated') || 'isolated',
      next_run: nextRun,
      status: 'active',
      created_at: now,
    };

    try {
      createTask(task);
      logger.info({ taskId, folder, scheduleType }, 'Task created via API');
      res.status(201).json({ task: { ...task, last_run: null, last_result: null } });
    } catch (err) {
      logger.error({ err, taskId }, 'Failed to create task via API');
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // --- DELETE /api/tasks/:id ---
  app.delete('/api/tasks/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;

    const existing = getTaskById(id);
    if (!existing) {
      res.status(404).json({ error: `Task ${id} not found` });
      return;
    }

    try {
      deleteTask(id);
      logger.info({ taskId: id }, 'Task deleted via API');
      res.json({ deleted: true, id });
    } catch (err) {
      logger.error({ err, taskId: id }, 'Failed to delete task via API');
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return new Promise<void>((resolve) => {
    app.listen(API_PORT, () => {
      logger.info({ port: API_PORT }, 'DURANDAL HTTP API server started');
      resolve();
    });
  });
}
