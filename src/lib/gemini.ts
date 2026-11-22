/**
 * Single place that talks to Google's Gemini API (used by the shopping/admin assistant and the Arabic translate button).
 * GEMINI_API_KEY is required. GEMINI_MODEL (optional) is tried first; if Google has retired a model (404) the next
 * one in the list is used automatically. gemini-2.0-flash was shut down on 1 June 2026.
 */
import { log } from './logger';

const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];
export const geminiModels = () => [...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean) as string[])];
let workingModel: string | null = null;

export class GeminiError extends Error {
  constructor(public status: number, public detail: string, public model: string) { super(`Gemini ${status} on ${model}: ${detail}`); }
}

/** Plain-language reason for admins. */
export function explainGemini(e: any): string {
  if (!(e instanceof GeminiError)) return String(e?.message || e).slice(0, 200);
  if (e.status === 400 && /API key/i.test(e.detail)) return 'GEMINI_API_KEY is not valid. Create a new key at aistudio.google.com and update it.';
  if (e.status === 403) return 'Gemini refused the key (403). Check the key is active and the Generative Language API is allowed for it.';
  if (e.status === 404) return `Model "${e.model}" does not exist or was retired. Set GEMINI_MODEL to a current model (for example gemini-3.6-flash).`;
  if (e.status === 503 || e.status === 500) return 'Every Gemini model is busy right now (high demand). It usually clears in a minute. Shoppers see a friendly message.';
  if (e.status === 429) return 'Gemini quota or rate limit reached (429). Wait a minute or enable billing on the key.';
  return `Gemini error ${e.status}: ${e.detail.slice(0, 160)}`;
}

export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;

export type GenOpts = { fast?: boolean; timeoutMs?: number; /** stop trying other models after this time (ms since epoch) so the request ends before Vercel's own time limit */ deadline?: number };

async function call(model: string, body: any, timeoutMs: number): Promise<any> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs), // a slow model must not hold the shopper: give up and try the next one
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text; try { detail = JSON.parse(text)?.error?.message || text; } catch {}
    // some models reject the "no thinking" setting: repeat once without it instead of failing over
    if (res.status === 400 && /think/i.test(detail) && body?.generationConfig?.thinkingConfig) {
      const { thinkingConfig, ...gc } = body.generationConfig;
      return call(model, { ...body, generationConfig: gc }, timeoutMs);
    }
    throw new GeminiError(res.status, detail, model);
  }
  return res.json();
}

const cooling = new Map<string, number>(); // model -> time until which we skip it (it said "busy")
const RETRYABLE = new Set([429, 500, 502, 503, 504]);   // busy / overloaded / temporary: try the next model
const MODEL_GONE = new Set([404, 400]);                  // retired or wrong name: try the next model

/**
 * generateContent with automatic model fallback. `body` is the normal REST body (contents, systemInstruction, tools, generationConfig).
 * If a model is overloaded ("high demand", 503/429) or retired, the next model is tried straight away, and the busy one is skipped for a minute.
 * If every model is busy, one more round is tried after a short pause. A bad API key stops immediately (no model will help).
 */
export async function generate(body: any, opts: GenOpts = {}): Promise<any> {
  const timeoutMs = opts.timeoutMs ?? (opts.fast ? 12_000 : 25_000);
  // short jobs (translate, descriptions) go to the lightweight model first: it answers in 1-3 seconds
  const models = opts.fast ? [...geminiModels().filter(m => /lite/.test(m)), ...geminiModels().filter(m => !/lite/.test(m))] : geminiModels();
  const all = !opts.fast && workingModel ? [workingModel, ...models.filter(m => m !== workingModel)] : models;
  let last: any;
  for (let round = 0; round < 2; round++) {
    const now = Date.now();
    const ready = all.filter(m => (cooling.get(m) || 0) <= now);
    const order = round === 0 && ready.length ? ready : all;
    for (const m of order) {
      if (opts.deadline && Date.now() > opts.deadline - 2000) throw last || new GeminiError(504, 'out of time: every model was too slow', m);
      try {
        const left = opts.deadline ? Math.max(3000, Math.min(timeoutMs, opts.deadline - Date.now())) : timeoutMs;
        const d = await call(m, body, left);
        if (workingModel !== m) { workingModel = m; log.info('gemini', `using model ${m}`); }
        cooling.delete(m);
        return d;
      } catch (e: any) {
        last = e;
        log.warn('gemini', 'model failed, trying the next one', { model: m, status: e?.status, detail: String(e?.detail || e?.message).slice(0, 200) });
        const isKey = e instanceof GeminiError && (e.status === 403 || /API key/i.test(e.detail));
        if (isKey) throw e;
        if (e instanceof GeminiError && RETRYABLE.has(e.status)) cooling.set(m, Date.now() + 60_000);
        else if (e instanceof GeminiError && MODEL_GONE.has(e.status)) { if (workingModel === m) workingModel = null; cooling.set(m, Date.now() + 10 * 60_000); }
        else if (e instanceof GeminiError) throw e;      // some other client error: the same request would fail everywhere
        // network error (fetch failed, timeout): fall through to the next model
      }
    }
    if (round === 0) await new Promise(r => setTimeout(r, 500));
  }
  throw last;
}
