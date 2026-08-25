import { AIChatMessage } from "./types";

// Ordered by preference. Free-tier models on OpenRouter get rate-limited or
// pulled with little notice, so we try each in turn and fall back on any
// non-2xx response, empty content, or timeout rather than surfacing an error.
export const OPENROUTER_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "google/gemma-4-31b-it:free",
] as const;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 20_000;

export class OpenRouterError extends Error {}

async function callModel(
  model: string,
  messages: AIChatMessage[],
  apiKey: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nettwin.local",
        "X-Title": "NetTwin AI Network Digital Twin",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 500,
        reasoning: { exclude: true },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new OpenRouterError(`${model} responded ${res.status}`);
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new OpenRouterError(`${model} returned empty content`);
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

// Try each free model in order; return the first success. Throws only if
// every model in the fallback chain fails.
export async function completeWithFallback(
  messages: AIChatMessage[],
  apiKey: string
): Promise<{ answer: string; model: string }> {
  let lastError: unknown;
  for (const model of OPENROUTER_MODELS) {
    try {
      const answer = await callModel(model, messages, apiKey);
      return { answer, model };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new OpenRouterError("All OpenRouter models failed");
}
