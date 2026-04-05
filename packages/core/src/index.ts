// DURANDAL Core Types & Constants

export * from "./templates";
export * from "./license";

export const DURANDAL_VERSION = "0.1.0";

export const HERMES_DEFAULT_PORT = 8642;
export const NANOCLAW_DEFAULT_PORT = 3000;
export const DASHBOARD_DEFAULT_PORT = 3001;

/** Task status lifecycle */
export type TaskStatus =
  | "pending"
  | "planning"
  | "executing"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

/** RBAC roles — Owner > Admin > Member */
export type UserRole = "owner" | "admin" | "member";

/** Agent task submitted via the dashboard */
export interface Task {
  id: string;
  templateId: string | null;
  status: TaskStatus;
  input: string;
  output: string | null;
  error: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** User account */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

/** Audit log entry */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  resource: string;
  details: string | null;
}

/** Template definition (loaded from YAML) */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: TemplateStep[];
  requiredCredentials: string[];
  networkAllowlist: string[];
  schedule: string | null;
}

export interface TemplateStep {
  name: string;
  tool: string;
  params: Record<string, unknown>;
  requiresApproval: boolean;
}

/** Health check response */
export interface HealthStatus {
  service: string;
  status: "healthy" | "unhealthy" | "starting";
  version: string;
  uptime: number;
}
