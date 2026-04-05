import fs from "node:fs";
import path from "node:path";
import { parseTemplate, type TemplateDef } from "@durandal/core";

/**
 * Resolve the templates directory.
 * In Docker the templates are mounted at /app/templates.
 * In local dev they live at the repo root (two levels up from apps/dashboard).
 */
function getTemplatesDir(): string {
  const dockerPath = "/app/templates";
  if (fs.existsSync(dockerPath)) {
    return dockerPath;
  }
  // Local dev: resolve relative to the project root
  // apps/dashboard -> ../../templates
  return path.resolve(process.cwd(), "../../templates");
}

let cachedTemplates: TemplateDef[] | null = null;

/**
 * Load and parse all YAML templates from the templates directory.
 * Results are cached in memory after the first call.
 * Pass `forceReload: true` to bypass cache.
 */
export function loadAllTemplates(forceReload = false): TemplateDef[] {
  if (cachedTemplates && !forceReload) {
    return cachedTemplates;
  }

  const dir = getTemplatesDir();
  if (!fs.existsSync(dir)) {
    console.warn(`Templates directory not found: ${dir}`);
    return [];
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  const templates: TemplateDef[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const parsed = parseTemplate(content);
      templates.push(parsed);
    } catch (err) {
      console.error(
        `Failed to parse template ${file}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  cachedTemplates = templates;
  return templates;
}

/**
 * Load a single template by its ID.
 * Returns `null` if no template with that ID exists.
 */
export function loadTemplate(id: string): TemplateDef | null {
  const templates = loadAllTemplates();
  return templates.find((t) => t.id === id) ?? null;
}
