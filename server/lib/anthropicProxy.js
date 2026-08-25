const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';

const MAX_MESSAGE_LEN = 500;
const MAX_CONTEXT_LEN = 4000;
const MAX_TOKENS = 400;
const REQUEST_TIMEOUT_MS = 20_000;

export class ChatProxyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function buildSystemPrompt(context) {
  return `You are GALLEY AI, a rapid-fire cooking assistant helping a chef mid-cook under a hard time deadline. Answer in 1-3 short sentences max, extremely direct and actionable. No preamble, no pleasantries, no markdown headers. Use the current kitchen state below to tailor your answer.\n\n${context}`;
}

/**
 * Proxies a single-turn question to the Anthropic Messages API, keeping the
 * API key server-side. Shared by the Express route (server/index.js) and
 * the Vercel serverless function (api/chat.js) so both hosting paths use
 * identical validation, limits, and error handling.
 */
export async function getGalleyAiReply({ message, context }) {
  if (typeof message !== 'string' || !message.trim()) {
    throw new ChatProxyError('message is required');
  }
  if (message.length > MAX_MESSAGE_LEN) {
    throw new ChatProxyError(`message must be under ${MAX_MESSAGE_LEN} characters`);
  }

  const safeContext = typeof context === 'string' ? context.slice(0, MAX_CONTEXT_LEN) : '';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ChatProxyError('Server is not configured with an ANTHROPIC_API_KEY', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(safeContext),
        messages: [{ role: 'user', content: message }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ChatProxyError('Request to Anthropic API timed out', 504);
    }
    throw new ChatProxyError('Failed to reach Anthropic API', 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || '';
    } catch {
      // response body wasn't JSON; fall through with generic message
    }
    throw new ChatProxyError(detail || 'Anthropic API request failed', response.status >= 500 ? 502 : 400);
  }

  const data = await response.json();
  const reply = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return reply || "Couldn't get a clear answer — try rephrasing.";
}
