/**
 * One entry point for "write / translate / summarise this" jobs, shared by the Translate button, Write with AI and background jobs.
 * Two providers, split by job so the free quota goes where customers are waiting:
 *   - 'live'  jobs (a person is waiting: Translate button, Write with AI)    Gemini first (fast, free tier), OpenAI as backup
 *   - 'bulk'  jobs (background SEO / descriptions / translation)             OpenAI first (cheap, nobody waits), Gemini as backup
 * If only one key exists, that one does everything. If the first provider fails, the other answers automatically.
 * AI_BULK_PROVIDER=gemini|openai overrides who goes first for bulk jobs.
 */
import { generate, geminiConfigured, explainGemini, GeminiError } from './gemini';
import { openaiConfigured, openaiCall, openaiTextOf, explainOpenAI, OpenAIError } from './openai';
import { log } from './logger';

export const aiConfigured = () => geminiConfigured() || openaiConfigured();
export const aiProviderName = () => [geminiConfigured() && 'Gemini', openaiConfigured() && 'OpenAI'].filter(Boolean).join(' + ') || 'none';

export type AiProvider = 'gemini' | 'openai';
export type AiJob = 'live' | 'bulk';

export function providerOrder(job: AiJob): AiProvider[] {
  const have: AiProvider[] = [];
  if (geminiConfigured()) have.push('gemini');
  if (openaiConfigured()) have.push('openai');
  const first: AiProvider = job === 'bulk' ? ((process.env.AI_BULK_PROVIDER as AiProvider) || 'openai') : 'gemini';
  return have.sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
}

export interface AiRequest { system: string; user: string; json?: boolean; fast?: boolean; maxTokens?: number; job?: AiJob; deadline?: number }

async function viaGemini(o: AiRequest): Promise<string> {
  const d = await generate({
    systemInstruction: { parts: [{ text: o.system }] },
    contents: [{ role: 'user', parts: [{ text: o.user }] }],
    generationConfig: { temperature: o.json ? 0.2 : 0.5, maxOutputTokens: o.maxTokens ?? 4096, ...(o.json ? { responseMimeType: 'application/json' } : {}), thinkingConfig: { thinkingBudget: 0 } },
  }, { fast: o.fast, deadline: o.deadline });
  return (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim();
}
async function viaOpenAI(o: AiRequest): Promise<string> {
  const d = await openaiCall({
    messages: [{ role: 'system', content: o.system + (o.json ? '\nReturn ONLY a valid JSON object.' : '') }, { role: 'user', content: o.user }],
    temperature: o.json ? 0.2 : 0.5, max_tokens: o.maxTokens ?? 2500, ...(o.json ? { response_format: { type: 'json_object' } } : {}),
  }, { timeoutMs: o.fast ? 20_000 : 40_000 });
  return openaiTextOf(d);
}

export async function aiText(o: AiRequest): Promise<{ text: string; provider: AiProvider }> {
  const order = providerOrder(o.job || 'live');
  if (!order.length) throw new Error('No AI key is set. Add GEMINI_API_KEY and/or OPENAI_API_KEY in the server environment.');
  let lastErr: any;
  for (const p of order) {
    try {
      const text = p === 'gemini' ? await viaGemini(o) : await viaOpenAI(o);
      if (text) return { text, provider: p };
      lastErr = new Error(`${p} returned an empty answer`);
    } catch (e: any) {
      lastErr = e;
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
