/**
 * DURANDAL Template Schema, Parser, and Validator
 *
 * Defines the Zod-based schema for YAML workflow templates,
 * plus utilities to parse and validate them.
 */

import yaml from "js-yaml";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TEMPLATE_CATEGORIES = [
  "finance",
  "communication",
  "marketing",
  "operations",
  "support",
  "general",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const PARAMETER_TYPES = [
  "string",
  "number",
  "boolean",
  "select",
  "email",
  "url",
  "cron",
] as const;

export type ParameterType = (typeof PARAMETER_TYPES)[number];

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

/** Schema for a single template parameter */
export const TemplateParameterSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Parameter name must be lowercase snake_case starting with a letter",
    ),
  label: z.string().min(1),
  type: z.enum(PARAMETER_TYPES),
  required: z.boolean().default(true),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
  options: z.array(z.string()).optional(),
});

/** Schema for a single workflow step */
export const TemplateStepSchema = z.object({
  name: z.string().min(1),
  tool: z.string().min(1),
  prompt: z.string().min(1),
  requiresApproval: z.boolean().default(false),
  networkAllowlist: z.array(z.string()).default([]),
  timeout: z
    .number()
    .int()
    .positive()
    .default(300_000), // 5 minutes default
});

/** Top-level template schema */
export const TemplateSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      "Template id must be lowercase kebab-case starting with a letter",
    ),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  category: z.enum(TEMPLATE_CATEGORIES),
  icon: z.string().min(1),
  requiredCredentials: z.array(z.string()).default([]),
  parameters: z.array(TemplateParameterSchema).default([]),
  steps: z.array(TemplateStepSchema).min(1),
  schedule: z.string().nullable().default(null),
  networkAllowlist: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type TemplateParameter = z.infer<typeof TemplateParameterSchema>;
export type TemplateStepDef = z.infer<typeof TemplateStepSchema>;
export type TemplateDef = z.infer<typeof TemplateSchema>;

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

export interface TemplateValidationResult {
  valid: boolean;
  errors?: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse raw YAML content into a validated `TemplateDef`.
 *
 * Throws if the YAML is malformed or fails schema validation.
 */
export function parseTemplate(yamlContent: string): TemplateDef {
  const raw: unknown = yaml.load(yamlContent);
  return TemplateSchema.parse(raw);
}

/**
 * Validate raw YAML content against the template schema without throwing.
 *
 * Returns `{ valid: true }` on success, or `{ valid: false, errors: [...] }`
 * with human-readable error messages on failure.
 */
export function validateTemplate(yamlContent: string): TemplateValidationResult {
  try {
    const raw: unknown = yaml.load(yamlContent);
    const result = TemplateSchema.safeParse(raw);

    if (result.success) {
      return { valid: true };
    }

    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    });

    return { valid: false, errors };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown parsing error";
    return { valid: false, errors: [message] };
  }
}
