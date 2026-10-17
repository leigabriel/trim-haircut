/**
 * Provider calls and the failover between them.
 *
 * Both providers are reached through an OpenAI-compatible chat completions
 * surface, so there is one request shape and one response shape. That keeps the
 * failover to a loop rather than two parallel implementations.
 *
 * Nothing here touches Deno, so vitest can import it directly.
 */

export type ProviderId = 'gemini' | 'openrouter';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderConfig {
  id: ProviderId;
  url: string;
  apiKey: string;
  model: string;
  /**
   * OpenAI-compatible reasoning effort, sent only when set. Gemini maps this
   * onto its thinking level.
   */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface ProviderResult {
  provider: ProviderId;
  content: string;
}

export interface ProviderFailure {
  provider: ProviderId;
  status: number;
  body: string;
}

/** Wall clock for one provider call. Generous, because a cold start is slow. */
export const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Output token ceiling, sent as max_tokens.
 *
 * This is NOT the length of the reply. Gemini counts thinking tokens against
 * the same budget, and Gemini 3.x Flash defaults to a medium thinking level
 * when reasoning_effort is omitted. At the old 600 the thinking spent most or
 * all of it and the visible answer was cut off mid-sentence.
 *
 * See https://ai.google.dev/gemini-api/docs/thinking: "max_output_tokens
 * applies to the combined total of thinking tokens and output tokens" and
 * "lower thinking_level instead of setting a small max_output_tokens".
 *
 * Sized to leave room for both while staying far under the database's 8000
 * character ceiling on a saved message.
 */
export const MAX_TOKENS = 2048;

/** Builds the request body, keeping provider quirks out of the fetch call. */
export function buildRequestBody(
  config: ProviderConfig,
  messages: ChatMessage[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: MAX_TOKENS,
    temperature: 0.6,
  };

  // Defaulted here rather than only at the call site, so adding a second Gemini
  // provider later cannot silently reintroduce the truncation bug.
  //
  // Never sent to OpenRouter: it routes to many models and some reject unknown
  // parameters, which would turn a working provider into a 400 and remove the
  // failover.
  const effort = config.reasoningEffort ?? (config.id === 'gemini' ? 'low' : undefined);
  if (effort) body.reasoning_effort = effort;

  return body;
}

/** The reason the provider stopped generating, or null when it did not say. */
export function readFinishReason(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const reason = (choices[0] as { finish_reason?: unknown } | undefined)?.finish_reason;
  return typeof reason === 'string' ? reason : null;
}

/**
 * Whether the reply was cut short by the token ceiling.
 *
 * A truncated completion still arrives as HTTP 200 with readable text, so
 * without this the partial answer was stored and shown as if it were whole.
 * The caller turns this into a failure so the other provider gets a turn.
 */
export function isTruncated(payload: unknown): boolean {
  return readFinishReason(payload) === 'length';
}

/**
 * Whether a failure from one provider is worth retrying on the other.
 *
 * Retryable: rate limits, timeouts and server errors, plus auth errors. An
 * invalid Gemini key should not take the whole feature down when a working
 * OpenRouter key exists, so 401/403 fall through too.
 *
 * Not retryable: 400 and 404. A malformed or unknown request fails identically
 * on both providers, so retrying only doubles the wait before the same error.
 */
export function shouldFailover(status: number): boolean {
  // 0 = abort, DNS failure, connection reset (from the catch block).
  if (status === 0) return true;
  if (status === 429 || status === 408) return true;
  if (status >= 500 && status <= 599) return true;
  if (status === 401 || status === 403) return true;
  return false;
}

/** Reads the reply out of an OpenAI-shaped completion. */
export function readContent(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as { message?: { content?: unknown } } | undefined)?.message;
  const content = message?.content;

  return typeof content === 'string' && content.trim().length > 0 ? content : null;
}

/**
 * Calls one provider. Returns a failure rather than throwing, so the caller
 * can decide whether the next provider is worth trying.
 */
export async function callProvider(
  config: ProviderConfig,
  messages: ChatMessage[],
): Promise<ProviderResult | ProviderFailure> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(buildRequestBody(config, messages)),
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      return { provider: config.id, status: response.status, body: text.slice(0, 400) };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      // A 200 with a body that is not JSON means the endpoint or key is wrong.
      return { provider: config.id, status: 502, body: text.slice(0, 400) };
    }

    const content = readContent(payload);
    if (content === null) {
      return { provider: config.id, status: 502, body: text.slice(0, 400) };
    }

    // 200 with a cut-off body. Returned as a failure so the other provider can
    // try, rather than stored and shown as a finished answer.
    if (isTruncated(payload)) {
      return {
        provider: config.id,
        status: 502,
        body: 'Reply hit the token ceiling and was cut off mid-sentence.',
      };
    }

    return { provider: config.id, content };
  } catch (error) {
    // Abort, DNS failure, connection reset: all worth trying the other provider.
    const reason = error instanceof Error ? error.message : String(error);
    return { provider: config.id, status: 0, body: reason };
  } finally {
    clearTimeout(timer);
  }
}

export const isFailure = (
  result: ProviderResult | ProviderFailure,
): result is ProviderFailure => 'status' in result;

/**
 * Runs the providers in order, falling through only on retryable failures.
 * A non-retryable failure is returned immediately rather than being retried
 * somewhere it cannot succeed.
 */
export async function callWithFailover(
  providers: ProviderConfig[],
  messages: ChatMessage[],
): Promise<{ ok: true; value: ProviderResult } | { ok: false; errors: ProviderFailure[] }> {
  const errors: ProviderFailure[] = [];

  for (const provider of providers) {
    const result = await callProvider(provider, messages);

    if (!isFailure(result)) return { ok: true, value: result };

    errors.push(result);
    if (!shouldFailover(result.status)) break;
  }

  return { ok: false, errors };
}