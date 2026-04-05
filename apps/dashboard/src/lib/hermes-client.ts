import { config } from "./config";

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

  const res = await fetch(`${config.hermesUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "hermes-agent",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Hermes API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    response: data.choices?.[0]?.message?.content ?? "",
    sessionId: res.headers.get("X-Hermes-Session-Id") ?? sessionId,
  };
}

export async function checkHermesHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${config.hermesUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
