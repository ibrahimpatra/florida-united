/**
 * OpenAI (Chat Completions) as the second AI provider. Optional: set OPENAI_API_KEY in the server environment.
 *   OPENAI_MODEL  default gpt-4o-mini   (small and cheap: a product description costs a fraction of a cent)
 * It is not free: OpenAI bills per use (a few cents for hundreds of products). Gemini has a free tier, so the app uses
 * Gemini for the live assistant and OpenAI for background jobs, and each one covers for the other if it fails.
 */
export const openaiConfigured = () => !!process.env.OPENAI_API_KEY;
export const openaiModel = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';

export class OpenAIError extends Error {
  constructor(public status: number, public detail: string) { super(`OpenAI ${status}: ${detail}`); }
}

export function explainOpenAI(e: any): string {
  if (!(e instanceof OpenAIError)) return String(e?.message || e).slice(0, 200);
  if (e.status === 401) return 'OPENAI_API_KEY is not valid. Create a key at platform.openai.com/api-keys.';
  if (e.status === 404) return 'The OpenAI model name was not found. Check OPENAI_MODEL.';
  if (e.status === 429) return 'OpenAI quota or credit balance reached (429). Add credit at platform.openai.com/settings/organization/billing.';
  if (e.status >= 500) return 'OpenAI is busy right now. Try again in a minute.';
  return `OpenAI error ${e.status}: ${e.detail.slice(0, 160)}`;
}

export async function openaiCall(body: any, opts: { timeoutMs?: number } = {}): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: openaiModel(), ...body }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text; try { detail = JSON.parse(text)?.error?.message || text; } catch { /* keep raw */ }
    throw new OpenAIError(res.status, detail);
  }
  return res.json();
}

export const openaiTextOf = (d: any): string => String(d?.choices?.[0]?.message?.content || '').trim();

/** Gemini-style function declarations (OBJECT/STRING...) -> OpenAI tools. */
export function toOpenAITools(decls: any[]) {
  const lower = (s: any): any => Array.isArray(s) ? s.map(lower)
    : s && typeof s === 'object' ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === 'type' && typeof v === 'string' ? v.toLowerCase() : lower(v)]))
    : s;
  return decls.map(d => ({ type: 'function', function: { name: d.name, description: d.description, parameters: lower(d.parameters || { type: 'object', properties: {} }) } }));
}

/** Assistant loop with tools (same contract as the Gemini loop: tools only PROPOSE writes, the admin confirms in the chat). */
export async function openaiAgent(opts: {
  system: string; history: { role: 'user' | 'assistant'; text: string }[]; tools: any[]; maxTurns?: number; deadline?: number;
  runTool: (name: string, args: any) => Promise<{ data: any; pending?: any }>;
}): Promise<{ text: string; pending: any[] }> {
  const messages: any[] = [{ role: 'system', content: opts.system }, ...opts.history.map(m => ({ role: m.role, content: m.text }))];
  const pending: any[] = [];
  const tools = toOpenAITools(opts.tools);
  for (let turn = 0; turn < (opts.maxTurns ?? 8); turn++) {
    const left = opts.deadline ? Math.max(4000, opts.deadline - Date.now()) : 30_000;
    const d = await openaiCall({ messages, tools, temperature: 0.3, max_tokens: 1500 }, { timeoutMs: Math.min(30_000, left) });
    const msg = d?.choices?.[0]?.message;
    const calls = msg?.tool_calls || [];
    if (!calls.length) return { text: String(msg?.content || '').trim(), pending };
    messages.push(msg);
    for (const c of calls) {
      let out: any;
      try { const r = await opts.runTool(c.function.name, JSON.parse(c.function.arguments || '{}')); out = r.data; if (r.pending) pending.push(r.pending); }
      catch (e: any) { out = { error: e?.name === 'OrderError' && e?.message ? e.message : 'The lookup failed.' }; }
      messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(out ?? null).slice(0, 20000) });
    }
  }
  return { text: '', pending };
}
