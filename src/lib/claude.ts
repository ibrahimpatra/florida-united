/**
 * Claude (Anthropic Messages API) for the store: descriptions, translation and the in-app assistant.
 * Optional: set ANTHROPIC_API_KEY in the server environment to switch it on. Without it everything keeps using Gemini.
 *   ANTHROPIC_MODEL       main model for the assistant and descriptions   (default claude-sonnet-5-5)
 *   ANTHROPIC_FAST_MODEL  quick jobs such as translation                  (default claude-haiku-5-5)
 */
export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const claudeModel = (fast = false) =>
  (fast ? process.env.ANTHROPIC_FAST_MODEL : process.env.ANTHROPIC_MODEL) || (fast ? 'claude-haiku-5-5' : 'claude-sonnet-5-5');

export class ClaudeError extends Error {
  constructor(public status: number, public detail: string) { super(`Claude ${status}: ${detail}`); }
}

export function explainClaude(e: any): string {
  if (!(e instanceof ClaudeError)) return String(e?.message || e).slice(0, 200);
  if (e.status === 401) return 'ANTHROPIC_API_KEY is not valid. Create a key at console.anthropic.com and update it.';
  if (e.status === 403) return 'The Anthropic key is not allowed to use this model (403).';
  if (e.status === 404) return 'The Claude model name was not found. Check ANTHROPIC_MODEL / ANTHROPIC_FAST_MODEL.';
  if (e.status === 429) return 'Anthropic rate limit or credit balance reached (429). Check billing in console.anthropic.com.';
  if (e.status === 529 || e.status >= 500) return 'Claude is busy right now (overloaded). Try again in a minute.';
  return `Claude error ${e.status}: ${e.detail.slice(0, 160)}`;
}

/** One Messages API call. `body` is the normal request body without `model`. */
export async function claudeCall(body: any, opts: { fast?: boolean; timeoutMs?: number } = {}): Promise<any> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: claudeModel(opts.fast), max_tokens: 2048, ...body }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? (opts.fast ? 15_000 : 40_000)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text; try { detail = JSON.parse(text)?.error?.message || text; } catch {}
    throw new ClaudeError(res.status, detail);
  }
  return res.json();
}

export const claudeTextOf = (d: any): string => (d?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();

/** Gemini-style function declarations (OBJECT/STRING...) -> Claude tool definitions. */
export function toClaudeTools(decls: any[]) {
  const lower = (s: any): any => Array.isArray(s) ? s.map(lower)
    : s && typeof s === 'object' ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === 'type' && typeof v === 'string' ? v.toLowerCase() : lower(v)]))
    : s;
  return decls.map(d => ({ name: d.name, description: d.description, input_schema: lower(d.parameters || { type: 'object', properties: {} }) }));
}

export type ClaudeTurn = { role: 'user' | 'assistant'; text: string };

/**
 * Assistant loop with tools. `runTool` returns { data, pending? }. Writes are never executed here: tools only PROPOSE
 * (pending), and the admin presses Confirm in the chat, exactly like the Gemini path.
 */
export async function claudeAgent(opts: {
  system: string; history: ClaudeTurn[]; tools: any[]; maxTurns?: number;
  runTool: (name: string, args: any) => Promise<{ data: any; pending?: any }>;
}): Promise<{ text: string; pending: any[] }> {
  const messages: any[] = opts.history.map(m => ({ role: m.role, content: m.text }));
  while (messages.length && messages[0].role !== 'user') messages.shift(); // the API needs the first message to come from the user
  const pending: any[] = [];
  const tools = toClaudeTools(opts.tools);
  for (let turn = 0; turn < (opts.maxTurns ?? 8); turn++) {
    const d = await claudeCall({ system: opts.system, messages, tools, max_tokens: 2048 });
    const uses = (d.content || []).filter((b: any) => b.type === 'tool_use');
    if (d.stop_reason !== 'tool_use' || !uses.length) return { text: claudeTextOf(d), pending };
    messages.push({ role: 'assistant', content: d.content });
    const results: any[] = [];
    for (const u of uses) {
      let out: any, isError = false;
      try { const r = await opts.runTool(u.name, u.input || {}); out = r.data; if (r.pending) pending.push(r.pending); }
      catch (e: any) { isError = true; out = { error: e?.name === 'OrderError' && e?.message ? e.message : 'The lookup failed.' }; }
      results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out ?? null).slice(0, 20000), ...(isError ? { is_error: true } : {}) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { text: '', pending };
}
