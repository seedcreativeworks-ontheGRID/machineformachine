const ELEVENLABS_TTS_URL = (voiceId) => `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
const DEFAULT_MODEL = 'eleven_turbo_v2_5';

const MAX_TEXT_LEN = 300;
const REQUEST_TIMEOUT_MS = 15_000;

export class SpeechProxyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Synthesizes speech for the LIVE TASKS voice cues using a cloned
 * ElevenLabs voice (see scripts/clone-voice.js for the one-time setup that
 * produces ELEVENLABS_VOICE_ID). Shared by the Express route
 * (server/index.js) and the Vercel serverless function (api/speak.js), same
 * pattern as anthropicProxy.js.
 *
 * Returns a Buffer of MP3 audio.
 */
export async function synthesizeSpeech({ text }) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new SpeechProxyError('text is required');
  }
  if (text.length > MAX_TEXT_LEN) {
    throw new SpeechProxyError(`text must be under ${MAX_TEXT_LEN} characters`);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    throw new SpeechProxyError('Server is not configured with ElevenLabs credentials', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(ELEVENLABS_TTS_URL(voiceId), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'audio/mpeg',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || DEFAULT_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.85 },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new SpeechProxyError('Request to ElevenLabs API timed out', 504);
    }
    throw new SpeechProxyError('Failed to reach ElevenLabs API', 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.detail?.message || errBody?.detail || '';
    } catch {
      // response body wasn't JSON; fall through with generic message
    }
    throw new SpeechProxyError(detail || 'ElevenLabs API request failed', response.status >= 500 ? 502 : 400);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
