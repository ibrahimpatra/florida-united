/** Rough cost estimates from our own token counters. These are ESTIMATES (list prices change): the provider's own bill is the truth. USD per 1 million tokens: [input, output]. */
const PRICES: { match: RegExp; usd: [number, number] }[] = [
  { match: /flash-lite|lite/i, usd: [0.10, 0.40] },
  { match: /gemini.*flash/i, usd: [0.30, 2.50] },
  { match: /gemini.*pro/i, usd: [1.25, 10] },
  { match: /gpt-4o-mini|gpt-.*mini/i, usd: [0.15, 0.60] },
  { match: /gpt/i, usd: [2.50, 10] },
];
export function estimateUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICES.find(x => x.match.test(model))?.usd || [0.30, 2.50];
  return (tokensIn * p[0] + tokensOut * p[1]) / 1_000_000;
}

/** Turns one aiUsage day document into plain numbers for the screen. */
export function summariseDay(d: Record<string, any>) {
  const num = (k: string) => Number(d[k]) || 0;
  const models: { model: string; calls: number; tokensIn: number; tokensOut: number; usd: number }[] = [];
  const providers: { provider: string; calls: number; errors: number; tokensIn: number; tokensOut: number }[] = [];
  for (const k of Object.keys(d)) {
    let m = /^m_(.+)_calls$/.exec(k);
    if (m) { const tin = num(`m_${m[1]}_in`), tout = num(`m_${m[1]}_out`); models.push({ model: m[1].replace(/_/g, '-'), calls: num(k), tokensIn: tin, tokensOut: tout, usd: estimateUsd(m[1].replace(/_/g, '-'), tin, tout) }); }
    m = /^p_(.+)_calls$/.exec(k);
    if (m) providers.push({ provider: m[1], calls: num(k), errors: num(`p_${m[1]}_errors`), tokensIn: num(`p_${m[1]}_in`), tokensOut: num(`p_${m[1]}_out`) });
  }
  const tasks = Object.keys(d).filter(k => /^t_.+_calls$/.test(k)).map(k => ({ task: k.slice(2, -6).replace(/_/g, ' '), calls: num(k) })).sort((a, b) => b.calls - a.calls);
  return {
    day: String(d.id || d.day || ''), calls: num('calls'), errors: num('errors'), fallbacks: num('fallbacks'), bulkCalls: num('bulkCalls'),
    tokensIn: num('tokensIn'), tokensOut: num('tokensOut'), avgMs: num('calls') ? Math.round(num('ms') / num('calls')) : 0,
    usd: models.reduce((a, m) => a + m.usd, 0), models: models.sort((a, b) => b.calls - a.calls), providers, tasks,
    lastError: d.lastError || '', lastErrorAt: d.lastErrorAt || '',
  };
}

/** Optional cross-check with OpenAI's own numbers (needs an OpenAI ADMIN key in OPENAI_ADMIN_KEY; a normal key cannot read usage). Google has no such call: Google numbers are only what we count. */
export async function openaiBilling(days = 30): Promise<{ ok: boolean; error?: string; perDay?: { day: string; usd: number }[]; totalUsd?: number }> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) return { ok: false, error: 'not-configured' };
  try {
    const start = Math.floor(Date.now() / 1000) - days * 86400;
    const r = await fetch(`https://api.openai.com/v1/organization/costs?start_time=${start}&bucket_width=1d&limit=${days}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (!r.ok) return { ok: false, error: `OpenAI answered ${r.status}. Check that OPENAI_ADMIN_KEY is an admin key.` };
    const j: any = await r.json();
    const perDay = (j.data || []).map((b: any) => ({ day: new Date((b.start_time || 0) * 1000).toISOString().slice(0, 10), usd: (b.results || []).reduce((a: number, x: any) => a + Number(x?.amount?.value || 0), 0) }));
    return { ok: true, perDay, totalUsd: perDay.reduce((a: number, x: any) => a + x.usd, 0) };
  } catch (e: any) { return { ok: false, error: String(e?.message || e).slice(0, 120) }; }
}
