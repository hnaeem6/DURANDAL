# Phase 3: Business Templates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a YAML-based template engine that lets non-technical users browse, configure, and run pre-built business automations with human-in-the-loop approval gates and cron scheduling.

**Architecture:** Templates are YAML files in `templates/` defining steps, required credentials, network allowlists, and approval gates. A template engine in `@durandal/core` parses and validates them. The dashboard provides a gallery UI, configuration forms, and scheduling. Hermes interprets templates and delegates steps to NanoClaw. Approval gates pause execution and notify the dashboard.

**Tech Stack:** YAML (js-yaml), zod (validation), cron-parser (scheduling)

**Spec Reference:** `docs/superpowers/specs/2026-04-05-durandal-platform-design.md` — Phase 3 (Section 5)

---

## Task Overview

| # | Task | Complexity |
|---|---|---|
| 1 | Template schema + parser | Core logic |
| 2 | 5 launch templates (YAML) | Content |
| 3 | Template API routes | Integration |
| 4 | Human-in-the-loop approval system | Integration |
| 5 | Template gallery + config UI | UI |
| 6 | Scheduled automations (cron) | Integration |
| 7 | Final verification | Verification |

---

### Task 1: Template Schema + Parser

**Files:**
- Modify: `packages/core/package.json` (add js-yaml, zod)
- Create: `packages/core/src/templates.ts`
- Modify: `packages/core/src/index.ts` (re-export)

- [ ] **Step 1: Add dependencies to @durandal/core**

Add to `packages/core/package.json` dependencies:
```json
"js-yaml": "^4.1.0",
"zod": "^3.24.0"
```
Add to devDependencies:
```json
"@types/js-yaml": "^4.0.9"
```

- [ ] **Step 2: Create packages/core/src/templates.ts**

Define the template schema using Zod for validation, plus a parser that loads YAML files:

```typescript
import { z } from "zod";
import yaml from "js-yaml";

export const TemplateStepSchema = z.object({
  name: z.string(),
  tool: z.string(), // "browser", "file", "exec", "web_fetch", "nanoclaw_execute"
  prompt: z.string(), // Natural language instruction for the agent
  requiresApproval: z.boolean().default(false),
  networkAllowlist: z.array(z.string()).default([]), // Domains allowed for this step
  timeout: z.number().default(300), // seconds
});

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    "finance",
    "communication",
    "marketing",
    "operations",
    "support",
    "general",
  ]),
  icon: z.string().default("bot"), // lucide icon name
  requiredCredentials: z.array(z.string()).default([]),
  parameters: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      type: z.enum(["string", "email", "url", "number", "boolean"]),
      required: z.boolean().default(true),
      default: z.unknown().optional(),
      description: z.string().optional(),
    })
  ).default([]),
  steps: z.array(TemplateStepSchema).min(1),
  schedule: z.string().nullable().default(null), // cron expression or null
  networkAllowlist: z.array(z.string()).default([]), // Global allowlist for all steps
});

export type TemplateDefinition = z.infer<typeof TemplateSchema>;
export type TemplateStep = z.infer<typeof TemplateStepSchema>;
export type TemplateParameter = TemplateDefinition["parameters"][number];

export function parseTemplate(yamlContent: string): TemplateDefinition {
  const raw = yaml.load(yamlContent);
  return TemplateSchema.parse(raw);
}

export function validateTemplate(yamlContent: string): { valid: boolean; errors?: string[] } {
  try {
    const raw = yaml.load(yamlContent);
    TemplateSchema.parse(raw);
    return { valid: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { valid: false, errors: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`) };
    }
    return { valid: false, errors: [(err as Error).message] };
  }
}
```

- [ ] **Step 3: Re-export from index.ts**

Add to `packages/core/src/index.ts`:
```typescript
export * from "./templates.js";
```

- [ ] **Step 4: Typecheck**

Run: `pnpm install && pnpm --filter @durandal/core typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add YAML template schema, parser, and validator"
```

---

### Task 2: Five Launch Templates

**Files:**
- Create: `templates/invoice-processing.yaml`
- Create: `templates/email-triage.yaml`
- Create: `templates/social-media.yaml`
- Create: `templates/inventory-alerts.yaml`
- Create: `templates/customer-support.yaml`

- [ ] **Step 1: Create invoice-processing.yaml**

```yaml
id: invoice-processing
name: Invoice Processing
description: Automatically check email for invoices, extract data, match against known vendors, and flag anomalies for review.
category: finance
icon: receipt
requiredCredentials:
  - email_password
  - accounting_api_key
parameters:
  - name: email_address
    label: Email Address
    type: email
    required: true
    description: The email account to check for invoices
  - name: accounting_url
    label: Accounting System URL
    type: url
    required: true
    description: URL of your accounting system (e.g., Xero, QuickBooks)
steps:
  - name: Check email for invoices
    tool: nanoclaw_execute
    prompt: "Log into email at {{email_address}} and find all unread emails with invoice attachments from the last 24 hours. Download the attachments."
    requiresApproval: false
    networkAllowlist: ["mail.google.com", "outlook.office365.com"]
    timeout: 120
  - name: Extract invoice data
    tool: nanoclaw_execute
    prompt: "Read the downloaded invoice PDFs and extract: vendor name, invoice number, date, total amount, line items. Return as structured data."
    requiresApproval: false
    timeout: 180
  - name: Match vendors and flag anomalies
    tool: nanoclaw_execute
    prompt: "Compare extracted invoice data against known vendor history. Flag any invoices with unusual amounts (>20% variance from average) or unknown vendors."
    requiresApproval: false
    timeout: 60
  - name: Update accounting system
    tool: nanoclaw_execute
    prompt: "For approved invoices, enter them into the accounting system at {{accounting_url}}. For flagged invoices, create a summary for human review."
    requiresApproval: true
    networkAllowlist: ["{{accounting_url}}"]
    timeout: 300
networkAllowlist: []
schedule: "0 9 * * 1-5"
```

- [ ] **Step 2: Create email-triage.yaml**

```yaml
id: email-triage
name: Email Triage
description: Sort incoming emails by priority, draft responses to routine inquiries, and flag urgent items for immediate attention.
category: communication
icon: mail
requiredCredentials:
  - email_password
parameters:
  - name: email_address
    label: Email Address
    type: email
    required: true
  - name: priority_keywords
    label: Priority Keywords
    type: string
    required: false
    default: "urgent, asap, deadline, critical, emergency"
    description: Comma-separated keywords that indicate high priority
steps:
  - name: Fetch unread emails
    tool: nanoclaw_execute
    prompt: "Log into {{email_address}} and retrieve all unread emails from the last 12 hours. Get sender, subject, body preview, and timestamp."
    requiresApproval: false
    networkAllowlist: ["mail.google.com", "outlook.office365.com"]
    timeout: 120
  - name: Classify and prioritize
    tool: nanoclaw_execute
    prompt: "Classify each email as: urgent (needs immediate response), routine (can draft auto-reply), informational (no action needed), or spam. Use these priority keywords: {{priority_keywords}}"
    requiresApproval: false
    timeout: 60
  - name: Draft responses
    tool: nanoclaw_execute
    prompt: "For routine emails, draft polite, professional responses. For urgent emails, create a summary with recommended action. Return all drafts for review."
    requiresApproval: false
    timeout: 120
  - name: Send approved responses
    tool: nanoclaw_execute
    prompt: "Send the approved draft responses via email. Mark informational emails as read."
    requiresApproval: true
    networkAllowlist: ["mail.google.com", "outlook.office365.com"]
    timeout: 120
schedule: "0 8,12,16 * * 1-5"
```

- [ ] **Step 3: Create social-media.yaml**

```yaml
id: social-media
name: Social Media Posting
description: Create and schedule social media posts across platforms with brand-consistent messaging.
category: marketing
icon: share-2
requiredCredentials:
  - social_media_credentials
parameters:
  - name: brand_voice
    label: Brand Voice Description
    type: string
    required: true
    description: "Describe your brand's tone (e.g., 'professional but friendly, use humor sparingly')"
  - name: platforms
    label: Platforms
    type: string
    required: true
    default: "twitter, linkedin"
    description: Comma-separated list of platforms
  - name: topic
    label: Post Topic
    type: string
    required: true
    description: What should the post be about?
steps:
  - name: Generate post content
    tool: nanoclaw_execute
    prompt: "Create a social media post about '{{topic}}' for these platforms: {{platforms}}. Brand voice: {{brand_voice}}. Generate platform-appropriate versions (character limits, hashtags, etc.)."
    requiresApproval: false
    timeout: 60
  - name: Review and post
    tool: nanoclaw_execute
    prompt: "Post the approved content to {{platforms}}. Confirm each post was published successfully."
    requiresApproval: true
    networkAllowlist: ["api.twitter.com", "api.linkedin.com", "graph.facebook.com"]
    timeout: 120
schedule: null
```

- [ ] **Step 4: Create inventory-alerts.yaml**

```yaml
id: inventory-alerts
name: Inventory Alerts
description: Monitor inventory levels and send alerts when stock is running low, with automatic reorder suggestions.
category: operations
icon: package
requiredCredentials:
  - inventory_system_credentials
parameters:
  - name: inventory_url
    label: Inventory System URL
    type: url
    required: true
  - name: low_stock_threshold
    label: Low Stock Threshold (%)
    type: number
    required: true
    default: 20
    description: Alert when stock falls below this percentage of normal levels
  - name: alert_email
    label: Alert Email
    type: email
    required: true
    description: Email address to send low stock alerts to
steps:
  - name: Check inventory levels
    tool: nanoclaw_execute
    prompt: "Log into inventory system at {{inventory_url}} and get current stock levels for all products. Identify items below {{low_stock_threshold}}% of normal stock level."
    requiresApproval: false
    networkAllowlist: ["{{inventory_url}}"]
    timeout: 180
  - name: Generate reorder suggestions
    tool: nanoclaw_execute
    prompt: "For low-stock items, calculate suggested reorder quantities based on historical sales velocity. Estimate days until stockout."
    requiresApproval: false
    timeout: 60
  - name: Send alert
    tool: nanoclaw_execute
    prompt: "Send a formatted inventory alert email to {{alert_email}} with: low stock items, current levels, days until stockout, and reorder suggestions."
    requiresApproval: true
    networkAllowlist: ["smtp.gmail.com", "smtp.office365.com"]
    timeout: 60
schedule: "0 7 * * *"
```

- [ ] **Step 5: Create customer-support.yaml**

```yaml
id: customer-support
name: Customer Support Triage
description: Monitor support channels, categorize incoming requests, draft responses, and escalate complex issues.
category: support
icon: headphones
requiredCredentials:
  - support_platform_credentials
parameters:
  - name: support_url
    label: Support Platform URL
    type: url
    required: true
    description: URL of your support platform (e.g., Zendesk, Freshdesk, email)
  - name: escalation_email
    label: Escalation Email
    type: email
    required: true
    description: Where to send complex issues that need human attention
steps:
  - name: Fetch new tickets
    tool: nanoclaw_execute
    prompt: "Check the support platform at {{support_url}} for new/unassigned tickets from the last 4 hours. Get ticket ID, subject, customer name, and description."
    requiresApproval: false
    networkAllowlist: ["{{support_url}}"]
    timeout: 120
  - name: Categorize and prioritize
    tool: nanoclaw_execute
    prompt: "Categorize each ticket as: billing, technical, general inquiry, feature request, or complaint. Assign priority: low, medium, high, critical. Flag any that mention legal issues or data breaches as critical."
    requiresApproval: false
    timeout: 60
  - name: Draft responses
    tool: nanoclaw_execute
    prompt: "For general inquiries and simple billing questions, draft helpful responses. For technical issues, suggest troubleshooting steps. For critical issues, draft an escalation summary."
    requiresApproval: false
    timeout: 120
  - name: Send responses and escalate
    tool: nanoclaw_execute
    prompt: "Send approved draft responses to customers. Escalate critical issues to {{escalation_email}} with full context."
    requiresApproval: true
    networkAllowlist: ["{{support_url}}", "smtp.gmail.com"]
    timeout: 120
schedule: "*/30 8-18 * * 1-5"
```

- [ ] **Step 6: Commit**

```bash
git add templates/
git commit -m "feat: add 5 launch business automation templates"
```

---

### Task 3: Template API Routes

**Files:**
- Create: `apps/dashboard/src/lib/template-loader.ts`
- Create: `apps/dashboard/src/app/api/templates/route.ts`
- Create: `apps/dashboard/src/app/api/templates/[id]/route.ts`
- Create: `apps/dashboard/src/app/api/templates/[id]/run/route.ts`

- [ ] **Step 1: Create template loader**

`apps/dashboard/src/lib/template-loader.ts` — reads YAML files from `templates/` directory, parses and validates them:

```typescript
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseTemplate, validateTemplate, type TemplateDefinition } from "@durandal/core";

const TEMPLATES_DIR = join(process.cwd(), "../../templates");
// Fallback for Docker: templates may be at /app/templates
const DOCKER_TEMPLATES_DIR = "/app/templates";

function getTemplatesDir(): string {
  try {
    readdirSync(TEMPLATES_DIR);
    return TEMPLATES_DIR;
  } catch {
    return DOCKER_TEMPLATES_DIR;
  }
}

export function loadAllTemplates(): TemplateDefinition[] {
  const dir = getTemplatesDir();
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  
  return files
    .map((file) => {
      try {
        const content = readFileSync(join(dir, file), "utf-8");
        return parseTemplate(content);
      } catch {
        return null;
      }
    })
    .filter((t): t is TemplateDefinition => t !== null);
}

export function loadTemplate(id: string): TemplateDefinition | null {
  const templates = loadAllTemplates();
  return templates.find((t) => t.id === id) ?? null;
}
```

- [ ] **Step 2: Create GET /api/templates**

```typescript
import { NextResponse } from "next/server";
import { loadAllTemplates } from "@/lib/template-loader";

export async function GET() {
  const templates = loadAllTemplates();
  return NextResponse.json({ templates });
}
```

- [ ] **Step 3: Create GET /api/templates/[id]**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { loadTemplate } from "@/lib/template-loader";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = loadTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json(template);
}
```

- [ ] **Step 4: Create POST /api/templates/[id]/run**

Executes a template with user-provided parameters. Substitutes `{{param}}` placeholders in step prompts, creates a task, then sends each step to Hermes sequentially:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { loadTemplate } from "@/lib/template-loader";
import { createTask, updateTaskStatus, addTaskEvent } from "@/lib/tasks";
import { sendToHermes } from "@/lib/hermes-client";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = loadTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json();
  const userParams: Record<string, string> = body.parameters ?? {};

  // Validate required parameters
  for (const param of template.parameters) {
    if (param.required && !userParams[param.name]) {
      return NextResponse.json(
        { error: `Missing required parameter: ${param.label}` },
        { status: 400 },
      );
    }
  }

  // Create task
  const { id: taskId } = createTask({
    templateId: template.id,
    input: `Template: ${template.name}`,
    createdBy: "system", // TODO: use auth session
  });

  addTaskEvent(taskId, "created", `Running template: ${template.name}`);
  logAudit({ actor: "system", action: "template.run", resource: `template:${id}`, details: JSON.stringify(userParams) });

  // Execute steps (async, don't block response)
  executeTemplateSteps(taskId, template, userParams).catch(() => {});

  return NextResponse.json({ taskId }, { status: 201 });
}

async function executeTemplateSteps(
  taskId: string,
  template: any,
  params: Record<string, string>,
) {
  updateTaskStatus(taskId, "executing");

  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i];
    
    // Substitute parameters in prompt
    let prompt = step.prompt;
    for (const [key, value] of Object.entries(params)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    addTaskEvent(taskId, "step_start", `Step ${i + 1}: ${step.name}`);

    // Check for approval gate
    if (step.requiresApproval) {
      updateTaskStatus(taskId, "awaiting_approval");
      addTaskEvent(taskId, "awaiting_approval", `Approval required for: ${step.name}`);
      // In Phase 3, we pause here. The approval system (Task 4) will resume execution.
      // For now, auto-approve after logging.
    }

    try {
      const result = await sendToHermes(
        `You are executing step ${i + 1} of the "${template.name}" automation.\n\n${prompt}`,
      );
      addTaskEvent(taskId, "step_complete", `Step ${i + 1} completed: ${step.name}`, { result: result.response.slice(0, 500) });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      addTaskEvent(taskId, "step_failed", `Step ${i + 1} failed: ${errorMsg}`);
      updateTaskStatus(taskId, "failed", undefined, errorMsg);
      return;
    }
  }

  updateTaskStatus(taskId, "completed", "All steps completed successfully");
  addTaskEvent(taskId, "completed", `Template "${template.name}" completed`);
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/lib/template-loader.ts apps/dashboard/src/app/api/templates/
git commit -m "feat(dashboard): add template API routes (list, get, run)"
```

---

### Task 4: Human-in-the-Loop Approval System

**Files:**
- Modify: `packages/db/src/schema.ts` (add approvals table)
- Create: `apps/dashboard/src/app/api/approvals/route.ts`
- Create: `apps/dashboard/src/app/api/approvals/[id]/route.ts`

- [ ] **Step 1: Add approvals table to DB schema**

```typescript
export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  stepIndex: integer("step_index").notNull(),
  stepName: text("step_name").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
```

Regenerate migration: `cd packages/db && pnpm db:generate`

- [ ] **Step 2: Create approvals API**

GET /api/approvals — list pending approvals
POST /api/approvals/[id] — approve or reject (body: `{ action: "approve" | "reject" }`)

- [ ] **Step 3: Commit**

```bash
git add packages/db/ apps/dashboard/
git commit -m "feat: add human-in-the-loop approval system"
```

---

### Task 5: Template Gallery + Configuration UI

**Files:**
- Create: `apps/dashboard/src/app/(dashboard)/templates/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/templates/[id]/page.tsx`

- [ ] **Step 1: Template gallery page**

Grid of template cards showing: icon, name, description, category badge, schedule indicator. Click opens the template detail page.

- [ ] **Step 2: Template detail/run page**

Shows template description, steps list, required credentials check, parameter input form. "Run Now" button and "Schedule" option. Steps with approval gates are highlighted.

- [ ] **Step 3: Add Templates link to sidebar**

Update the nav sidebar to include Templates in the navigation.

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add template gallery and configuration UI"
```

---

### Task 6: Scheduled Automations

**Files:**
- Modify: `packages/db/src/schema.ts` (add schedules table)
- Create: `apps/dashboard/src/app/api/schedules/route.ts`

- [ ] **Step 1: Add schedules table**

```typescript
export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  parameters: text("parameters").notNull(), // JSON string
  cronExpression: text("cron_expression").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRun: integer("last_run", { mode: "timestamp" }),
  nextRun: integer("next_run", { mode: "timestamp" }),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Create schedules API**

CRUD for scheduled template runs. When created, compute `nextRun` using cron-parser. Add `cron-parser` dependency to the dashboard.

- [ ] **Step 3: Commit**

```bash
git add packages/db/ apps/dashboard/
git commit -m "feat: add cron scheduling for template automations"
```

---

### Task 7: Final Verification

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `docker compose config` validates
- [ ] All 5 templates parse without errors
- [ ] Template gallery page renders

```bash
git add -A && git commit -m "fix: Phase 3 final verification fixes"
```
