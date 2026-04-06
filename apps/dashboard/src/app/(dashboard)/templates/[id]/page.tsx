"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Clock,
  Key,
  Play,
  Shield,
  CalendarPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Receipt,
  Mail,
  Share2,
  Package,
  PackageSearch,
  Headphones,
  Bot,
  FileText,
  BarChart3,
  Globe,
  Database,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Icon lookup
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  receipt: Receipt,
  mail: Mail,
  share2: Share2,
  package: Package,
  packagesearch: PackageSearch,
  headphones: Headphones,
  bot: Bot,
  filetext: FileText,
  barchart3: BarChart3,
  shield: Shield,
  globe: Globe,
  database: Database,
  zap: Zap,
  clock: Clock,
};

function getIcon(name: string): LucideIcon {
  const key = name.toLowerCase().replace(/[\s-]+/g, "");
  return ICON_MAP[key] ?? Bot;
}

// ---------------------------------------------------------------------------
// Category styles
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, string> = {
  finance: "bg-green-900/50 text-green-300 border-green-800",
  communication: "bg-blue-900/50 text-blue-300 border-blue-800",
  marketing: "bg-purple-900/50 text-purple-300 border-purple-800",
  operations: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  support: "bg-pink-900/50 text-pink-300 border-pink-800",
  general: "bg-gray-800/50 text-gray-400 border-gray-700",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateParam {
  name: string;
  label: string;
  type: string;
  required: boolean;
  default?: string | number | boolean;
  description?: string;
  options?: string[];
}

interface TemplateStep {
  name: string;
  tool: string;
  prompt: string;
  requiresApproval: boolean;
  networkAllowlist: string[];
  timeout: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requiredCredentials: string[];
  parameters: TemplateParam[];
  steps: TemplateStep[];
  schedule: string | null;
  networkAllowlist: string[];
}

interface Schedule {
  id: string;
  templateId: string;
  cronExpression: string;
  enabled: boolean;
  nextRun: string | null;
  lastRun: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TemplateDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Configuration form
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});

  // Run state
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{
    success: boolean;
    taskId?: string;
    status?: string;
    message?: string;
    errors?: string[];
  } | null>(null);

  // Schedule state
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [cronInput, setCronInput] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/templates/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (res.ok) {
          const data: Template = await res.json();
          setTemplate(data);

          // Initialise form defaults
          const defaults: Record<string, string | boolean> = {};
          for (const p of data.parameters) {
            if (p.default !== undefined) {
              defaults[p.name] =
                p.type === "boolean"
                  ? Boolean(p.default)
                  : String(p.default);
            } else {
              defaults[p.name] = p.type === "boolean" ? false : "";
            }
          }
          setFormValues(defaults);

          // Pre-fill cron input with template default
          if (data.schedule) {
            setCronInput(data.schedule);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Fetch existing schedules for this template
  useEffect(() => {
    async function loadSchedules() {
      try {
        const res = await fetch(`/api/schedules?templateId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setSchedules(data.schedules ?? []);
        }
      } catch {
        // ignore
      }
    }
    loadSchedules();
  }, [id]);

  function updateField(name: string, value: string | boolean) {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleRun() {
    if (!template) return;
    setRunning(true);
    setRunResult(null);

    // Validate required fields
    const missing: string[] = [];
    for (const p of template.parameters) {
      if (p.required && !formValues[p.name] && formValues[p.name] !== false) {
        missing.push(p.label);
      }
    }
    if (missing.length > 0) {
      setRunResult({
        success: false,
        errors: missing.map((m) => `${m} is required`),
      });
      setRunning(false);
      return;
    }

    // Build params (convert booleans to string for the API)
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(formValues)) {
      params[k] = String(v);
    }

    try {
      const res = await fetch(`/api/templates/${template.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      });
      const data = await res.json();
      if (res.ok || res.status === 202) {
        setRunResult({
          success: true,
          taskId: data.id,
          status: data.status,
          message: data.message ?? `Task created: ${data.id}`,
        });
      } else {
        setRunResult({
          success: false,
          errors: data.missing
            ? data.missing.map((m: string) => `Missing parameter: ${m}`)
            : [data.error ?? "Failed to run template"],
        });
      }
    } catch (err) {
      setRunResult({
        success: false,
        errors: [err instanceof Error ? err.message : "Network error"],
      });
    } finally {
      setRunning(false);
    }
  }

  async function handleSchedule() {
    if (!template || !cronInput.trim()) return;
    setScheduling(true);
    setScheduleError(null);

    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(formValues)) {
      params[k] = String(v);
    }

    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          parameters: params,
          cronExpression: cronInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSchedules((prev) => [data.schedule, ...prev]);
        setScheduleError(null);
      } else {
        setScheduleError(data.error ?? "Failed to create schedule");
      }
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScheduling(false);
    }
  }

  async function toggleSchedule(scheduleId: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === scheduleId ? { ...s, enabled } : s)),
        );
      }
    } catch {
      // ignore
    }
  }

  async function deleteSchedule(scheduleId: string) {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      }
    } catch {
      // ignore
    }
  }

  // Loading / not found states
  if (loading) {
    return (
      <div className="text-center text-gray-500 py-16">
        Loading template...
      </div>
    );
  }

  if (notFound || !template) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">Template not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/templates">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Gallery
          </Link>
        </Button>
      </div>
    );
  }

  const Icon = getIcon(template.icon);

  return (
    <div className="max-w-4xl">
      {/* Back link */}
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Gallery
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="h-14 w-14 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
          <Icon className="h-7 w-7 text-orange-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-100">
              {template.name}
            </h1>
            <Badge
              className={`capitalize text-xs ${CATEGORY_STYLES[template.category] ?? CATEGORY_STYLES.general}`}
            >
              {template.category}
            </Badge>
          </div>
          <p className="text-gray-400">{template.description}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            {template.schedule ? (
              <span>
                Default schedule:{" "}
                <span className="font-mono text-gray-400">
                  {template.schedule}
                </span>
              </span>
            ) : (
              <span>On demand</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Steps */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-100">Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {template.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-800 text-xs font-medium text-gray-400 shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">
                        {step.name}
                      </span>
                      {step.requiresApproval && (
                        <Badge className="bg-blue-900/50 text-blue-300 border-blue-800 text-[10px] px-1.5 py-0 h-4 gap-1">
                          <Shield className="h-3 w-3" />
                          Approval
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Tool: {step.tool}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Required Credentials */}
        {template.requiredCredentials.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-base text-gray-100 flex items-center gap-2">
                <Key className="h-4 w-4 text-gray-400" />
                Required Credentials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {template.requiredCredentials.map((cred) => (
                  <Badge
                    key={cred}
                    className="bg-gray-800 text-gray-300 border-gray-700 font-mono text-xs"
                  >
                    {cred}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration */}
        {template.parameters.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-base text-gray-100">
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {template.parameters.map((param) => (
                  <div key={param.name}>
                    <Label
                      htmlFor={param.name}
                      className="text-sm text-gray-200 mb-1.5 block"
                    >
                      {param.label}
                      {param.required && (
                        <span className="text-orange-400 ml-1">*</span>
                      )}
                    </Label>
                    {param.description && (
                      <p className="text-xs text-gray-500 mb-2">
                        {param.description}
                      </p>
                    )}

                    {param.type === "boolean" ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          id={param.name}
                          checked={Boolean(formValues[param.name])}
                          onChange={(e) =>
                            updateField(param.name, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                        />
                        <span className="text-sm text-gray-300">
                          {formValues[param.name] ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    ) : param.type === "select" && param.options ? (
                      <select
                        id={param.name}
                        value={String(formValues[param.name] ?? "")}
                        onChange={(e) => updateField(param.name, e.target.value)}
                        className="flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                      >
                        <option value="">Select...</option>
                        {param.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={param.name}
                        type={
                          param.type === "number"
                            ? "number"
                            : param.type === "email"
                              ? "email"
                              : param.type === "url"
                                ? "url"
                                : "text"
                        }
                        value={String(formValues[param.name] ?? "")}
                        onChange={(e) => updateField(param.name, e.target.value)}
                        placeholder={
                          param.default !== undefined
                            ? String(param.default)
                            : undefined
                        }
                        className="bg-gray-800 border-gray-700 text-gray-200 placeholder:text-gray-600"
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule Section */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-100 flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-gray-400" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="cron"
                  className="text-sm text-gray-200 mb-1.5 block"
                >
                  Cron Expression
                </Label>
                <p className="text-xs text-gray-500 mb-2">
                  e.g. &quot;0 9 * * 1-5&quot; for weekdays at 9 AM
                </p>
                <div className="flex gap-2">
                  <Input
                    id="cron"
                    value={cronInput}
                    onChange={(e) => setCronInput(e.target.value)}
                    placeholder="0 9 * * 1-5"
                    className="bg-gray-800 border-gray-700 text-gray-200 placeholder:text-gray-600 font-mono"
                  />
                  <Button
                    onClick={handleSchedule}
                    disabled={scheduling || !cronInput.trim()}
                    variant="outline"
                    className="shrink-0"
                  >
                    {scheduling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-4 w-4" />
                    )}
                    Schedule
                  </Button>
                </div>
                {scheduleError && (
                  <p className="text-sm text-red-400 mt-2">{scheduleError}</p>
                )}
              </div>

              {/* Existing schedules */}
              {schedules.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    Active schedules for this template
                  </p>
                  <div className="space-y-2">
                    {schedules.map((sched) => (
                      <div
                        key={sched.id}
                        className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-2 w-2 rounded-full ${sched.enabled ? "bg-green-500" : "bg-gray-600"}`}
                          />
                          <span className="text-sm font-mono text-gray-300">
                            {sched.cronExpression}
                          </span>
                          {sched.nextRun && (
                            <span className="text-xs text-gray-500">
                              Next:{" "}
                              {new Date(sched.nextRun).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toggleSchedule(sched.id, !sched.enabled)
                            }
                            className="text-xs"
                          >
                            {sched.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSchedule(sched.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Run */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRun}
            disabled={running}
            className="bg-orange-600 hover:bg-orange-500 text-white"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Now
          </Button>
        </div>

        {/* Run result */}
        {runResult && (
          <div
            className={`rounded-lg border p-4 ${
              runResult.success
                ? "bg-green-900/20 border-green-800"
                : "bg-red-900/20 border-red-800"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {runResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span
                className={`text-sm font-medium ${runResult.success ? "text-green-300" : "text-red-300"}`}
              >
                {runResult.success ? "Task created" : "Run failed"}
              </span>
            </div>
            {runResult.taskId && (
              <p className="text-sm text-gray-300">
                Task ID:{" "}
                <span className="font-mono text-gray-200">
                  {runResult.taskId}
                </span>
                {runResult.status && (
                  <Badge className="ml-2 capitalize bg-gray-800 text-gray-300 border-gray-700 text-xs">
                    {runResult.status}
                  </Badge>
                )}
              </p>
            )}
            {runResult.message && (
              <p className="text-sm text-gray-400 mt-1">{runResult.message}</p>
            )}
            {runResult.errors && (
              <ul className="mt-1 space-y-1">
                {runResult.errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-400">
                    {e}
                  </li>
                ))}
              </ul>
            )}
            {runResult.taskId && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                asChild
              >
                <Link href="/tasks">View Tasks</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
