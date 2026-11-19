/**
 * One entry point for "write / translate / summarise this" jobs. Uses Claude when ANTHROPIC_API_KEY is set, otherwise
 * (or if Claude fails) Gemini, so the buttons keep working either way.
 */
import { claudeConfigured, claudeCall, claudeTextOf, explainClaude } from './claude';
import { generate, geminiConfigured, explainGemini } from './gemini';
import { log } from './logger';

export const aiConfigured = () => claudeConfigured() || geminiConfigured();
export const aiProviderName = () => (claudeConfigured() ? 'Claude' : geminiConfigured() ? 'Gemini' : 'none');

export async function aiText(o: { system: string; user: string; json?: boolean; fast?: boolean; maxTokens?: number }): Promise<{ text: string; provider: 'claude' | 'gemini' }> {
  let claudeProblem = '';
  if (claudeConfigured()) {
    try {
      const d = await claudeCall({
        system: o.system + (o.json ? '\nReturn ONLY valid JSON, with no markdown fences and no commentary.' : ''),
        messages: [{ role: 'user', content: o.user }], max_tokens: o.maxTokens ?? 2048, temperature: o.json ? 0.2 : 0.5,
      }, { fast: o.fast });
      const text = claudeTextOf(d);
      if (text) return { text, provider: 'claude' };
    } catch (e: any) {
      claudeProblem = explainClaude(e);
      log.warn('ai', 'Claude failed, trying Gemini', { error: claudeProblem });
      if (!geminiConfigured()) throw e;
    }
  }
  if (!geminiConfigured()) throw new Error('No AI key is set. Add ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY in the server environment.');
  const d = await generate({
    systemInstruction: { parts: [{ text: o.system }] },
    contents: [{ role: 'user', parts: [{ text: o.user }] }],
    generationConfig: { temperature: o.json ? 0.2 : 0.5, maxOutputTokens: o.maxTokens ?? 4096, ...(o.json ? { responseMimeType: 'application/json' } : {}), thinkingConfig: { thinkingBudget: 0 } },
  }, { fast: o.fast });
  const text = (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim();
  return { text, provider: 'gemini' };
}

export const explainAi = (e: any) => (e?.name === 'Error' && /No AI key/.test(e.message) ? e.message : e?.status && e?.model ? explainGemini(e) : explainClaude(e));

/** Parses a JSON object out of a model answer, tolerating ``` fences or text around it. */
export function parseJsonLoose(raw: string): any {
  const t = String(raw || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(t); } catch { /* try the outermost braces */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* fall through */ } }
  return {};
}
