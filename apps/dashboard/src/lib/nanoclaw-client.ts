import { config } from "./config";

export async function executeInNanoClaw(req: {
  prompt: string;
  sessionId?: string;
  groupFolder?: string;
}): Promise<{
  status: "success" | "error";
  result: string | null;
  sessionId?: string;
  error?: string;
}> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.DURANDAL_API_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${config.nanoclawUrl}/api/execute`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`NanoClaw API error: ${res.status}`);
  }

  return res.json();
}

export async function checkNanoclawHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${config.nanoclawUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
