/**
 * One entry point for "write / translate / summarise this" jobs, shared by the Translate button, Write with AI and background jobs.
 * Gemini does all the work (live jobs use the best Flash model, background jobs start with the cheap lite models).
 * OpenAI is only a backup, used when its key is set and Gemini fails. AI_BULK_PROVIDER=openai still lets you put OpenAI first for background work.
 * Background jobs stop for the day at AI_BULK_DAILY_CAP calls (default 2000) so a big import cannot use up the quota; live jobs are never capped.
 * Every call is counted in aiUsage/<day> (see ai-usage.ts).
 */
import { generate, geminiConfigured, explainGemini, GeminiError } from './gemini';
import { openaiConfigured, openaiCall, openaiTextOf, explainOpenAI, OpenAIError } from './openai';
import { log } from './logger';
import { recordAiCall, assertBulkAllowed } from './ai-usage';

export const aiConfigured = () => geminiConfigured() || openaiConfigured();
export const aiProviderName = () => [geminiConfigured() && 'Gemini', openaiConfigured() && 'OpenAI'].filter(Boolean).join(' + ') || 'none';

export type AiProvider = 'gemini' | 'openai';
export type AiJob = 'live' | 'bulk';

export function providerOrder(job: AiJob): AiProvider[] {
  const have: AiProvider[] = [];
  if (geminiConfigured()) have.push('gemini');
  if (openaiConfigured()) have.push('openai');
  const first: AiProvider = job === 'bulk' && process.env.AI_BULK_PROVIDER === 'openai' ? 'openai' : 'gemini';
  return have.sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
}

export interface AiRequest { /** short name of what the call is for (shows in the usage tab) */ task?: string; system: string; user: string; json?: boolean; fast?: boolean; maxTokens?: number; job?: AiJob; deadline?: number }

interface Out { text: string; model?: string; tokensIn?: number; tokensOut?: number }
async function viaGemini(o: AiRequest): Promise<Out> {
  const d = await generate({
    systemInstruction: { parts: [{ text: o.system }] },
    contents: [{ role: 'user', parts: [{ text: o.user }] }],
    generationConfig: { temperature: o.json ? 0.2 : 0.5, maxOutputTokens: o.maxTokens ?? 4096, ...(o.json ? { responseMimeType: 'application/json' } : {}), thinkingConfig: { thinkingBudget: 0 } },
  }, { fast: o.fast, bulk: o.job === 'bulk', deadline: o.deadline });
  const u = d?.usageMetadata || {};
  return { text: (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim(), model: d?.modelVersion, tokensIn: u.promptTokenCount, tokensOut: u.candidatesTokenCount };
}
async function viaOpenAI(o: AiRequest): Promise<Out> {
  const d = await openaiCall({
    messages: [{ role: 'system', content: o.system + (o.json ? '\nReturn ONLY a valid JSON object.' : '') }, { role: 'user', content: o.user }],
    temperature: o.json ? 0.2 : 0.5, max_tokens: o.maxTokens ?? 2500, ...(o.json ? { response_format: { type: 'json_object' } } : {}),
  }, { timeoutMs: o.fast ? 20_000 : 40_000 });
  return { text: openaiTextOf(d), model: d?.model, tokensIn: d?.usage?.prompt_tokens, tokensOut: d?.usage?.completion_tokens };
}

export async function aiText(o: AiRequest): Promise<{ text: string; provider: AiProvider }> {
  const job = o.job || 'live';
  const order = providerOrder(job);
  if (!order.length) throw new Error('No AI key is set. Add GEMINI_API_KEY in the server environment.');
  if (job === 'bulk') await assertBulkAllowed();
  let lastErr: any;
  for (let i = 0; i < order.length; i++) {
    const p = order[i]; const t0 = Date.now();
    try {
      const r = p === 'gemini' ? await viaGemini(o) : await viaOpenAI(o);
      if (r.text) {
        void recordAiCall({ provider: p, model: r.model, job, task: o.task, tokensIn: r.tokensIn, tokensOut: r.tokensOut, ms: Date.now() - t0, ok: true, fallback: i > 0 });
        return { text: r.text, provider: p };
      }
      lastErr = new Error(`${p} returned an empty answer`);
      void recordAiCall({ provider: p, job, task: o.task, ms: Date.now() - t0, ok: false, error: 'empty answer', fallback: i > 0 });
    } catch (e: any) {
      lastErr = e;
      void recordAiCall({ provider: p, job, task: o.task, ms: Date.now() - t0, ok: false, error: explainAi(e), fallback: i > 0 });
      log.warn('ai', `${p} failed, trying the next provider`, { error: explainAi(e) });
    }
  }
  throw lastErr;
}

export const explainAi = (e: any): string =>
  e instanceof OpenAIError ? explainOpenAI(e) : e instanceof GeminiError ? explainGemini(e) : String(e?.message || e).slice(0, 220);

/** Parses a JSON object out of a model answer, tolerating ``` fences or text around it. */
export function parseJsonLoose(raw: string): any {
  const t = String(raw || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(t); } catch { /* try the outermost braces */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* fall through */ } }
  return {};
}
