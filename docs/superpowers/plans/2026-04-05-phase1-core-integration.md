# Phase 1: Core Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Hermes Agent and NanoClaw together so that a user can submit a task from the dashboard, Hermes plans and delegates it, NanoClaw executes steps in isolated containers, and results stream back to the dashboard in real-time.

**Architecture:** Dashboard (Next.js API routes + Socket.IO) → Hermes (OpenAI-compatible API on port 8642, with custom `nanoclaw_execute` tool) → NanoClaw (new HTTP API wrapping its container runner). Ollama provides local LLM inference. All communication over localhost within the Docker network.

**Tech Stack:** Next.js API routes, Socket.IO 4.x, Express (NanoClaw HTTP layer), Python tool registration (Hermes), Ollama, better-sqlite3

**Spec Reference:** `docs/superpowers/specs/2026-04-05-durandal-platform-design.md` — Phase 1 (Section 5)

**Key Discovery from Vendor Research:**
- Hermes starts its API via `hermes gateway run` with `API_SERVER_ENABLED=true` (there is NO `hermes serve` command)
- NanoClaw has NO HTTP API — it's channel-driven + filesystem IPC. We must add an HTTP layer to our fork.
- NanoClaw's `runContainerAgent()` accepts a `ContainerInput` (prompt, sessionId, groupFolder) and returns `ContainerOutput` (status, result, newSessionId).
- Hermes custom tools register via `tools/registry.py` — `registry.register(name, toolset, schema, handler)`.

---

## File Structure (new/modified files only)

```
vendors/nanoclaw/
├── src/
│   ├── api.ts                          # NEW: HTTP API server (Express)
│   └── index.ts                        # MODIFY: start API server on boot

vendors/hermes-agent/
├── tools/
│   └── nanoclaw_tool.py                # NEW: Custom tool to call NanoClaw API
├── durandal-config.yaml                # NEW: Pre-configured config for DURANDAL

apps/dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # MODIFY: add task submission UI
│   │   └── api/
│   │       ├── tasks/
│   │       │   ├── route.ts            # NEW: POST /api/tasks, GET /api/tasks
│   │       │   └── [id]/
│   │       │       └── route.ts        # NEW: GET/DELETE /api/tasks/:id
│   │       ├── health/
│   │       │   └── route.ts            # NEW: GET /api/health
│   │       └── memory/
│   │           └── route.ts            # NEW: GET/PUT /api/memory
│   ├── lib/
│   │   ├── hermes-client.ts            # NEW: HTTP client for Hermes API
│   │   ├── nanoclaw-client.ts          # NEW: HTTP client for NanoClaw API
│   │   ├── socket.ts                   # NEW: Socket.IO server setup
│   │   └── tasks.ts                    # NEW: Task CRUD operations (DB)
│   └── hooks/
│       └── use-task-stream.ts          # NEW: React hook for WebSocket events

packages/db/
├── src/
│   └── schema.ts                       # MODIFY: add task_events table

docker/
├── Dockerfile.hermes                   # MODIFY: fix CMD, add config
├── docker-compose.yml                  # MODIFY: add env vars for API server

scripts/
└── setup-ollama.sh                     # NEW: Download default model
```

---

### Task 1: Add HTTP API to NanoClaw Fork

**Files:**
- Create: `vendors/nanoclaw/src/api.ts`
- Modify: `vendors/nanoclaw/src/index.ts`
- Modify: `vendors/nanoclaw/package.json` (add express dep)

- [ ] **Step 1: Add express dependency to NanoClaw**

Edit `vendors/nanoclaw/package.json` — add to `dependencies`:
```json
"express": "^5.1.0",
"@types/express": "^5.0.0"
```

Run: `cd vendors/nanoclaw && npm install`

- [ ] **Step 2: Create vendors/nanoclaw/src/api.ts**

```typescript
import express from "express";
import { runContainerAgent } from "./container-runner.js";
import type { ContainerInput, ContainerOutput } from "./container-runner.js";
import {
  getScheduledTasks,
  insertScheduledTask,
  deleteScheduledTask,
} from "./db.js";
import { getRegisteredGroups } from "./db.js";
import { log } from "./logger.js";

const app = express();
app.use(express.json());

// Internal auth token (set via DURANDAL_API_TOKEN env var)
const API_TOKEN = process.env.DURANDAL_API_TOKEN || "";

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (API_TOKEN) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token !== API_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  next();
}

app.use(authMiddleware);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", service: "nanoclaw" });
});

// Execute a task in an isolated container
app.post("/api/execute", async (req, res) => {
  const { prompt, sessionId, groupFolder } = req.body;

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const folder = groupFolder || "durandal-tasks";
  const chatJid = `durandal:${Date.now()}`;

  const input: ContainerInput = {
    prompt,
    sessionId: sessionId || undefined,
    groupFolder: folder,
    chatJid,
    isMain: false,
    isScheduledTask: false,
  };

  try {
    const output = await new Promise<ContainerOutput>((resolve, reject) => {
      runContainerAgent(
        {
          name: "DURANDAL Task",
          folder,
          trigger: "",
          added_at: new Date().toISOString(),
          requiresTrigger: false,
          isMain: false,
        },
        input,
        (_proc, _containerName) => {
          // Container started — could emit events here
        },
        async (partialOutput) => {
          // Streaming partial results — could emit via SSE
          log.debug("Partial output:", partialOutput);
        },
      )
        .then(resolve)
        .catch(reject);
    });

    res.json({
      status: output.status,
      result: output.result,
      sessionId: output.newSessionId || sessionId,
      error: output.error,
    });
  } catch (err) {
    log.error("Execute failed:", err);
    res.status(500).json({
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// List scheduled tasks
app.get("/api/tasks", (_req, res) => {
  try {
    const tasks = getScheduledTasks();
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

// Create scheduled task
app.post("/api/tasks", (req, res) => {
  const { groupFolder, chatJid, prompt, scheduleType, scheduleValue } =
    req.body;

  if (!prompt || !scheduleType || !scheduleValue) {
    res.status(400).json({ error: "prompt, scheduleType, scheduleValue required" });
    return;
  }

  try {
    const id = crypto.randomUUID();
    insertScheduledTask({
      id,
      group_folder: groupFolder || "durandal-tasks",
      chat_jid: chatJid || `durandal:scheduled:${id}`,
      prompt,
      schedule_type: scheduleType,
      schedule_value: scheduleValue,
      status: "active",
      created_at: new Date().toISOString(),
    });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

// Delete scheduled task
app.delete("/api/tasks/:id", (req, res) => {
  try {
    deleteScheduledTask(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export function startApiServer(port: number = 3000): void {
  app.listen(port, "0.0.0.0", () => {
    log.info(`NanoClaw API server listening on port ${port}`);
  });
}
```

NOTE: The exact import paths and function names for DB operations (`getScheduledTasks`, `insertScheduledTask`, `deleteScheduledTask`) need to be verified against the actual `src/db.ts`. Read the file before implementing to get the correct function names. The `ContainerInput` interface is in `src/container-runner.ts` (line 37) and `RegisteredGroup` is in `src/types.ts` (line 35). Adapt the code to match actual exports.

- [ ] **Step 3: Modify vendors/nanoclaw/src/index.ts to start the API server**

Add this import near the top of `src/index.ts`:
```typescript
import { startApiServer } from "./api.js";
```

Add this call in the `main()` function, after `initDatabase()` (around line 575):
```typescript
// Start HTTP API for DURANDAL integration
const apiPort = parseInt(process.env.NANOCLAW_API_PORT || "3000", 10);
startApiServer(apiPort);
```

- [ ] **Step 4: Ensure the durandal-tasks group folder exists**

Add to `main()` after `loadState()`:
```typescript
// Ensure DURANDAL tasks group directory exists
import { mkdirSync, existsSync } from "fs";
const durandalGroupDir = path.join(GROUPS_DIR, "durandal-tasks", "logs");
if (!existsSync(durandalGroupDir)) {
  mkdirSync(durandalGroupDir, { recursive: true });
}
```

- [ ] **Step 5: Verify NanoClaw still compiles**

Run: `cd vendors/nanoclaw && npx tsc --noEmit`
If there are type errors, fix them. The key issue may be that `runContainerAgent` needs access to state that's set up during the full `main()` flow — if so, adjust the API handler to wait for initialization.

- [ ] **Step 6: Commit**

```bash
git add vendors/nanoclaw/
git commit -m "feat(nanoclaw): add HTTP API for DURANDAL integration"
```

---

### Task 2: Fix Hermes Docker Configuration

**Files:**
- Modify: `docker/Dockerfile.hermes`
- Create: `vendors/hermes-agent/durandal-config.yaml`
- Modify: `docker/docker-compose.yml`

- [ ] **Step 1: Create durandal-config.yaml for Hermes**

Read `vendors/hermes-agent/cli-config.yaml.example` first to understand the full config structure. Then create `vendors/hermes-agent/durandal-config.yaml`:

```yaml
# DURANDAL Hermes Configuration
# This is copied into the container at /root/.hermes/config.yaml

model:
  provider: "ollama"
  base_url: "http://ollama:11434/v1"
  default: "qwen2.5:7b"

api_server:
  enabled: true
  port: 8642
  host: "0.0.0.0"
  key: ""  # Auth handled by DURANDAL API layer

# Disable interactive features in container mode
terminal:
  backend: "local"

# Memory settings
memory:
  memory_char_limit: 2200
  user_char_limit: 1375

# Tool configuration — enable NanoClaw tool
toolsets:
  nanoclaw:
    tools: [nanoclaw_execute]
    description: "Execute tasks in isolated NanoClaw containers"
```

NOTE: Verify the exact config key names by reading `cli-config.yaml.example`. The YAML structure above is based on research — keys may differ slightly.

- [ ] **Step 2: Fix Dockerfile.hermes CMD**

Read current `docker/Dockerfile.hermes`, then replace the CMD line:

Old:
```dockerfile
CMD ["uv", "run", "hermes", "serve", "--host", "0.0.0.0", "--port", "8642"]
```

New:
```dockerfile
# Copy DURANDAL config
COPY vendors/hermes-agent/durandal-config.yaml /root/.hermes/config.yaml

ENV API_SERVER_ENABLED=true
ENV API_SERVER_PORT=8642
ENV API_SERVER_HOST=0.0.0.0

CMD ["uv", "run", "hermes", "gateway", "run"]
```

- [ ] **Step 3: Add Hermes env vars to docker-compose.yml**

Read current `docker/docker-compose.yml`. Add to the `hermes` service environment:
```yaml
environment:
  - OLLAMA_HOST=http://ollama:11434
  - HERMES_DATA=/data/hermes
  - API_SERVER_ENABLED=true
  - API_SERVER_PORT=8642
  - API_SERVER_HOST=0.0.0.0
  - NANOCLAW_URL=http://nanoclaw:3000
```

Also add `NANOCLAW_URL=http://nanoclaw:3000` to the nanoclaw service environment (it's used for internal reference).

- [ ] **Step 4: Verify docker compose config still validates**

Run: `cd /Users/hamzanaeem/Projects/DURANDAL/docker && docker compose config --quiet`

- [ ] **Step 5: Commit**

```bash
git add docker/ vendors/hermes-agent/durandal-config.yaml
git commit -m "fix(hermes): correct gateway CMD and add DURANDAL config"
```

---

### Task 3: Create Hermes-NanoClaw Bridge Tool

**Files:**
- Create: `vendors/hermes-agent/tools/nanoclaw_tool.py`

- [ ] **Step 1: Read the existing tool registry pattern**

Read `vendors/hermes-agent/tools/registry.py` to understand `registry.register()`. Then read an existing simple tool (e.g., `tools/web_search.py` or `tools/web_fetch.py`) to see the pattern for schema + handler + registration.

- [ ] **Step 2: Create vendors/hermes-agent/tools/nanoclaw_tool.py**

```python
"""
DURANDAL NanoClaw Integration Tool

Allows Hermes to execute tasks in NanoClaw's container-isolated environment.
Each execution runs in a fresh Linux container with no network by default.
"""

import json
import os
import urllib.request
import urllib.error
from tools.registry import registry

NANOCLAW_URL = os.environ.get("NANOCLAW_URL", "http://localhost:3000")
NANOCLAW_API_TOKEN = os.environ.get("DURANDAL_API_TOKEN", "")

NANOCLAW_EXECUTE_SCHEMA = {
    "name": "nanoclaw_execute",
    "description": (
        "Execute a task in an isolated container via NanoClaw. "
        "The task runs in a fresh Linux container with file system isolation "
        "and no network access by default. Use this for: browser automation, "
        "file operations, shell commands, web fetching, and any action that "
        "should be sandboxed. The prompt should be a clear instruction for "
        "the container agent."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "The task instruction for the container agent",
            },
            "session_id": {
                "type": "string",
                "description": "Optional session ID to continue a previous conversation",
            },
        },
        "required": ["prompt"],
    },
}


def nanoclaw_execute(args: dict, **kwargs) -> str:
    """Execute a task in NanoClaw's isolated container."""
    prompt = args.get("prompt", "")
    session_id = args.get("session_id")

    if not prompt:
        return "Error: prompt is required"

    payload = {"prompt": prompt}
    if session_id:
        payload["sessionId"] = session_id

    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if NANOCLAW_API_TOKEN:
        headers["Authorization"] = f"Bearer {NANOCLAW_API_TOKEN}"

    req = urllib.request.Request(
        f"{NANOCLAW_URL}/api/execute",
        data=data,
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if result.get("status") == "success":
            output = result.get("result", "Task completed successfully.")
            if result.get("sessionId"):
                output += f"\n[Session ID: {result['sessionId']}]"
            return output
        else:
            return f"Task failed: {result.get('error', 'Unknown error')}"

    except urllib.error.URLError as e:
        return f"Failed to connect to NanoClaw: {e}"
    except Exception as e:
        return f"NanoClaw execution error: {e}"


def check_nanoclaw_available() -> bool:
    """Check if NanoClaw API is reachable."""
    try:
        req = urllib.request.Request(f"{NANOCLAW_URL}/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False


# Register the tool
registry.register(
    name="nanoclaw_execute",
    toolset="nanoclaw",
    schema=NANOCLAW_EXECUTE_SCHEMA,
    handler=nanoclaw_execute,
    check_fn=check_nanoclaw_available,
    description="Execute tasks in isolated NanoClaw containers",
    emoji="🔨",
)
```

NOTE: Read existing tools first to verify the exact `registry.register()` signature and schema format. The schema format should match OpenAI function-calling schema. Adapt if needed.

- [ ] **Step 3: Verify the tool is discovered**

The tool registry auto-discovers tools by importing all modules in `tools/`. Check `model_tools.py` — it likely imports all `tools/*.py` files. If discovery is manual, add `import tools.nanoclaw_tool` to the discovery function.

- [ ] **Step 4: Commit**

```bash
git add vendors/hermes-agent/tools/nanoclaw_tool.py
git commit -m "feat(hermes): add nanoclaw_execute tool for container-isolated tasks"
```

---

### Task 4: Add task_events Table to DB Schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add task_events table for real-time event tracking**

Read `packages/db/src/schema.ts`, then add this table after the existing `tasks` table:

```typescript
export const taskEvents = sqliteTable("task_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id),
  type: text("type", {
    enum: ["created", "planning", "step_start", "step_complete", "step_failed", "awaiting_approval", "completed", "failed"],
  }).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"),  // JSON string for extra data
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Regenerate migration**

Run: `cd packages/db && pnpm db:generate`

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @durandal/db typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add task_events table for real-time event streaming"
```

---

### Task 5: Dashboard API Routes (Task CRUD)

**Files:**
- Create: `apps/dashboard/src/lib/hermes-client.ts`
- Create: `apps/dashboard/src/lib/nanoclaw-client.ts`
- Create: `apps/dashboard/src/lib/tasks.ts`
- Create: `apps/dashboard/src/app/api/health/route.ts`
- Create: `apps/dashboard/src/app/api/tasks/route.ts`
- Create: `apps/dashboard/src/app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Create apps/dashboard/src/lib/hermes-client.ts**

```typescript
import { config } from "./config";

interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

export async function sendToHermes(
  prompt: string,
  sessionId?: string,
): Promise<{ response: string; sessionId?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionId) {
    headers["X-Hermes-Session-Id"] = sessionId;
  }

  const body: ChatCompletionRequest = {
    model: "hermes-agent",
    messages: [{ role: "user", content: prompt }],
  };

  const res = await fetch(`${config.hermesUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Hermes API error: ${res.status} ${await res.text()}`);
  }

  const data: ChatCompletionResponse = await res.json();
  const responseText = data.choices?.[0]?.message?.content ?? "";

  return {
    response: responseText,
    sessionId: res.headers.get("X-Hermes-Session-Id") ?? sessionId,
  };
}

export async function checkHermesHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${config.hermesUrl}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Create apps/dashboard/src/lib/nanoclaw-client.ts**

```typescript
import { config } from "./config";

interface ExecuteRequest {
  prompt: string;
  sessionId?: string;
  groupFolder?: string;
}

interface ExecuteResponse {
  status: "success" | "error";
  result: string | null;
  sessionId?: string;
  error?: string;
}

export async function executeInNanoClaw(
  req: ExecuteRequest,
): Promise<ExecuteResponse> {
  const res = await fetch(`${config.nanoclawUrl}/api/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`NanoClaw API error: ${res.status}`);
  }

  return res.json();
}

export async function checkNanoclawHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${config.nanoclawUrl}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Create apps/dashboard/src/lib/tasks.ts**

```typescript
import { createDb } from "@durandal/db";
import { tasks, taskEvents } from "@durandal/db";
import { eq, desc } from "drizzle-orm";
import { config } from "./config";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

export async function createTask(input: {
  templateId?: string;
  input: string;
  createdBy: string;
}) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(tasks).values({
    id,
    templateId: input.templateId ?? null,
    status: "pending",
    input: input.input,
    output: null,
    error: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  }).run();

  return { id };
}

export async function getTask(id: string) {
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return null;

  const events = db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, id))
    .orderBy(taskEvents.timestamp)
    .all();

  return { ...task, events };
}

export async function listTasks(limit = 50) {
  const db = getDb();
  return db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(limit).all();
}

export async function updateTaskStatus(
  id: string,
  status: string,
  output?: string,
  error?: string,
) {
  const db = getDb();
  db.update(tasks)
    .set({
      status,
      output: output ?? undefined,
      error: error ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .run();
}

export async function addTaskEvent(
  taskId: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  const db = getDb();
  db.insert(taskEvents).values({
    id: crypto.randomUUID(),
    taskId,
    type,
    message,
    metadata: metadata ? JSON.stringify(metadata) : null,
    timestamp: new Date(),
  }).run();
}

export async function cancelTask(id: string) {
  await updateTaskStatus(id, "cancelled");
}
```

- [ ] **Step 4: Create apps/dashboard/src/app/api/health/route.ts**

```typescript
import { NextResponse } from "next/server";
import { DURANDAL_VERSION } from "@durandal/core";
import { checkHermesHealth } from "@/lib/hermes-client";
import { checkNanoclawHealth } from "@/lib/nanoclaw-client";

export async function GET() {
  const [hermes, nanoclaw] = await Promise.all([
    checkHermesHealth(),
    checkNanoclawHealth(),
  ]);

  return NextResponse.json({
    status: hermes && nanoclaw ? "healthy" : "degraded",
    version: DURANDAL_VERSION,
    services: {
      hermes: hermes ? "healthy" : "unhealthy",
      nanoclaw: nanoclaw ? "healthy" : "unhealthy",
    },
  });
}
```

- [ ] **Step 5: Create apps/dashboard/src/app/api/tasks/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasks, addTaskEvent, updateTaskStatus } from "@/lib/tasks";
import { sendToHermes } from "@/lib/hermes-client";

// POST /api/tasks — create and execute a task
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { input, templateId } = body;

  if (!input) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  // Create task record
  const { id } = await createTask({
    input,
    templateId,
    createdBy: "system", // TODO: replace with auth user in Phase 2
  });

  await addTaskEvent(id, "created", `Task created: ${input.slice(0, 100)}`);

  // Execute asynchronously — send to Hermes and update when done
  // For Phase 1, we do this synchronously (Phase 2 adds WebSocket streaming)
  try {
    await updateTaskStatus(id, "executing");
    await addTaskEvent(id, "planning", "Sending to Hermes for planning and execution");

    const result = await sendToHermes(input);

    await updateTaskStatus(id, "completed", result.response);
    await addTaskEvent(id, "completed", "Task completed successfully");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await updateTaskStatus(id, "failed", undefined, errorMsg);
    await addTaskEvent(id, "failed", `Task failed: ${errorMsg}`);
  }

  // Return the task ID immediately (client can poll for status)
  return NextResponse.json({ id }, { status: 201 });
}

// GET /api/tasks — list all tasks
export async function GET() {
  const taskList = await listTasks();
  return NextResponse.json({ tasks: taskList });
}
```

- [ ] **Step 6: Create apps/dashboard/src/app/api/tasks/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTask, cancelTask } from "@/lib/tasks";

// GET /api/tasks/:id — get task details with events
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = await getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

// DELETE /api/tasks/:id — cancel a task
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await cancelTask(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Verify dashboard builds**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/lib/ apps/dashboard/src/app/api/
git commit -m "feat(dashboard): add task CRUD API routes and service clients"
```

---

### Task 6: WebSocket Event Stream (Socket.IO)

**Files:**
- Modify: `apps/dashboard/package.json` (add socket.io deps)
- Create: `apps/dashboard/src/lib/socket.ts`
- Create: `apps/dashboard/src/hooks/use-task-stream.ts`

- [ ] **Step 1: Add Socket.IO dependencies**

Edit `apps/dashboard/package.json` — add to `dependencies`:
```json
"socket.io": "^4.8.0",
"socket.io-client": "^4.8.0"
```

Run: `pnpm install`

- [ ] **Step 2: Create apps/dashboard/src/lib/socket.ts**

```typescript
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

export function getSocketServer(): SocketIOServer {
  if (!io) {
    io = new SocketIOServer({
      cors: { origin: "*" },
      path: "/api/socket",
    });

    io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on("subscribe:task", (taskId: string) => {
        socket.join(`task:${taskId}`);
      });

      socket.on("unsubscribe:task", (taskId: string) => {
        socket.leave(`task:${taskId}`);
      });

      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }
  return io;
}

export function emitTaskEvent(
  taskId: string,
  event: {
    type: string;
    message: string;
    metadata?: Record<string, unknown>;
  },
) {
  const server = getSocketServer();
  server.to(`task:${taskId}`).emit("task:event", {
    taskId,
    ...event,
    timestamp: new Date().toISOString(),
  });
}
```

NOTE: Next.js 15 with App Router has limited WebSocket support. The Socket.IO server may need to run alongside Next.js via a custom server, or use Server-Sent Events (SSE) instead. If Socket.IO integration proves problematic, fall back to SSE via a streaming API route:

```typescript
// Alternative: apps/dashboard/src/app/api/tasks/[id]/stream/route.ts
export async function GET(req: NextRequest, { params }) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Poll task events and push them
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" }
  });
}
```

Choose whichever approach works with Next.js 15.

- [ ] **Step 3: Create apps/dashboard/src/hooks/use-task-stream.ts**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";

interface TaskEvent {
  taskId: string;
  type: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function useTaskStream(taskId: string | null) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [status, setStatus] = useState<string>("idle");

  const pollEvents = useCallback(async () => {
    if (!taskId) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setEvents(data.events || []);
      }
    } catch {
      // Ignore polling errors
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    // Poll every 2 seconds for updates
    pollEvents();
    const interval = setInterval(pollEvents, 2000);

    return () => clearInterval(interval);
  }, [taskId, pollEvents]);

  return { events, status };
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add WebSocket/polling event stream for task monitoring"
```

---

### Task 7: Dashboard Task Submission UI

**Files:**
- Modify: `apps/dashboard/src/app/page.tsx`

- [ ] **Step 1: Update the home page with task submission**

Read current `apps/dashboard/src/app/page.tsx`, then replace with:

```tsx
"use client";

import { useState } from "react";
import { DURANDAL_VERSION } from "@durandal/core";
import { useTaskStream } from "@/hooks/use-task-stream";

export default function Home() {
  const [input, setInput] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { events, status } = useTaskStream(taskId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Failed: ${res.status}`);
      }

      const { id } = await res.json();
      setTaskId(id);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8 pt-16">
      <h1 className="text-4xl font-bold tracking-wider mb-2 bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
        DURANDAL
      </h1>
      <p className="text-gray-500 text-sm mb-8">v{DURANDAL_VERSION}</p>

      {/* Task Input */}
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What should DURANDAL do?"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !input.trim()}
            className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            {submitting ? "Sending..." : "Run"}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </form>

      {/* Task Status */}
      {taskId && (
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-400 text-sm">Task {taskId.slice(0, 8)}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                status === "completed"
                  ? "bg-green-900 text-green-300"
                  : status === "failed"
                    ? "bg-red-900 text-red-300"
                    : "bg-yellow-900 text-yellow-300"
              }`}
            >
              {status}
            </span>
          </div>

          <div className="space-y-2">
            {events.map((event, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-lg p-3"
              >
                <div className="flex justify-between items-start">
                  <span className="text-gray-300 text-sm">{event.message}</span>
                  <span className="text-gray-600 text-xs ml-2 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/page.tsx
git commit -m "feat(dashboard): add task submission UI with live event stream"
```

---

### Task 8: LLM Router Setup (Ollama)

**Files:**
- Create: `scripts/setup-ollama.sh`
- Modify: `docker/docker-compose.yml` (add model pull init container)

- [ ] **Step 1: Create scripts/setup-ollama.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

MODEL="${OLLAMA_DEFAULT_MODEL:-qwen2.5:7b}"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "DURANDAL — Ollama Setup"
echo "======================"
echo ""
echo "Pulling model: $MODEL"
echo "Ollama host: $OLLAMA_HOST"
echo ""

# Wait for Ollama to be ready
for i in $(seq 1 30); do
  if curl -sf "$OLLAMA_HOST/" > /dev/null 2>&1; then
    echo "Ollama is ready."
    break
  fi
  echo "Waiting for Ollama... ($i/30)"
  sleep 2
done

# Pull the model
echo ""
echo "Downloading $MODEL (this may take several minutes)..."
curl -sf "$OLLAMA_HOST/api/pull" -d "{\"name\": \"$MODEL\"}" | while IFS= read -r line; do
  status=$(echo "$line" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$status" ]; then
    printf "\r  %s" "$status"
  fi
done
echo ""
echo ""
echo "Model $MODEL is ready."
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/setup-ollama.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-ollama.sh
git commit -m "feat: add Ollama model setup script"
```

---

### Task 9: Memory API Endpoint

**Files:**
- Create: `apps/dashboard/src/app/api/memory/route.ts`

- [ ] **Step 1: Create the memory API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const MEMORY_DIR = join(
  process.env.HERMES_DATA || "/data/hermes",
  "memories",
);

// GET /api/memory — read agent memory
export async function GET() {
  try {
    const memoryPath = join(MEMORY_DIR, "MEMORY.md");
    const userPath = join(MEMORY_DIR, "USER.md");

    const memory = existsSync(memoryPath)
      ? readFileSync(memoryPath, "utf-8")
      : "";
    const user = existsSync(userPath)
      ? readFileSync(userPath, "utf-8")
      : "";

    return NextResponse.json({ memory, user });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to read memory" },
      { status: 500 },
    );
  }
}

// PUT /api/memory — update agent memory
export async function PUT(req: NextRequest) {
  try {
    const { memory, user } = await req.json();

    if (!existsSync(MEMORY_DIR)) {
      mkdirSync(MEMORY_DIR, { recursive: true });
    }

    if (memory !== undefined) {
      writeFileSync(join(MEMORY_DIR, "MEMORY.md"), memory, "utf-8");
    }
    if (user !== undefined) {
      writeFileSync(join(MEMORY_DIR, "USER.md"), user, "utf-8");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/api/memory/
git commit -m "feat(dashboard): add memory API endpoint for agent memory access"
```

---

### Task 10: Basic CLI

**Files:**
- Create: `scripts/durandal.sh`

- [ ] **Step 1: Create the CLI wrapper**

```bash
#!/usr/bin/env bash
set -euo pipefail

# DURANDAL CLI
# Wraps docker compose commands for easy management

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="$(cd "$SCRIPT_DIR/../docker" && pwd)"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed. Install Docker first."
  exit 1
fi

cmd="${1:-help}"
shift 2>/dev/null || true

case "$cmd" in
  start)
    echo "Starting DURANDAL..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "DURANDAL is running. Open https://localhost"
    ;;
  stop)
    echo "Stopping DURANDAL..."
    docker compose -f "$COMPOSE_FILE" down
    echo "DURANDAL stopped."
    ;;
  restart)
    echo "Restarting DURANDAL..."
    docker compose -f "$COMPOSE_FILE" restart
    echo "DURANDAL restarted."
    ;;
  status)
    echo "DURANDAL Service Status"
    echo "======================"
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f "$@"
    ;;
  build)
    echo "Building DURANDAL images..."
    docker compose -f "$COMPOSE_FILE" build "$@"
    ;;
  update)
    echo "Updating DURANDAL..."
    docker compose -f "$COMPOSE_FILE" pull
    docker compose -f "$COMPOSE_FILE" up -d
    echo "DURANDAL updated."
    ;;
  backup)
    BACKUP_FILE="durandal-backup-$(date +%Y-%m-%d).tar.gz"
    echo "Creating backup: $BACKUP_FILE"
    docker compose -f "$COMPOSE_FILE" exec dashboard \
      tar czf /tmp/backup.tar.gz /data/ 2>/dev/null
    docker compose -f "$COMPOSE_FILE" cp dashboard:/tmp/backup.tar.gz "./$BACKUP_FILE"
    echo "Backup saved to $BACKUP_FILE"
    ;;
  help|--help|-h)
    echo "DURANDAL CLI"
    echo ""
    echo "Usage: durandal <command>"
    echo ""
    echo "Commands:"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  status      Show service status"
    echo "  logs        Show live logs (add service name to filter)"
    echo "  build       Build Docker images"
    echo "  update      Pull latest images and restart"
    echo "  backup      Create a backup archive"
    echo "  help        Show this help message"
    ;;
  *)
    echo "Unknown command: $cmd"
    echo "Run 'durandal help' for usage."
    exit 1
    ;;
esac
```

- [ ] **Step 2: Make executable and create symlink instruction**

Run: `chmod +x scripts/durandal.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/durandal.sh
git commit -m "feat: add durandal CLI wrapper for Docker Compose management"
```

---

## Phase 1 Completion Checklist

After all tasks are done, verify these acceptance criteria from the spec:

- [ ] NanoClaw has an HTTP API that accepts task execution requests
- [ ] Hermes has a custom `nanoclaw_execute` tool registered
- [ ] Hermes Docker config uses correct `gateway run` command with API server enabled
- [ ] Dashboard has POST/GET/DELETE /api/tasks routes that work end-to-end
- [ ] Dashboard home page has a task submission form with live status updates
- [ ] Ollama setup script can pull a default model
- [ ] Memory API allows reading/writing Hermes memory files
- [ ] CLI wrapper provides start/stop/status/logs commands
- [ ] `pnpm build` still passes across all packages
- [ ] `docker compose config` still validates
