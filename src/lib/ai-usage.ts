/**
 * Counts every AI call, one small document per day (aiUsage/YYYY-MM-DD) with increment counters, so usage can be seen without storing prompts or answers.
 *   calls, errors, fallbacks, tokensIn, tokensOut, ms           totals for the day
 *   bulkCalls                                                    background-job calls (the daily cap uses this)
 *   p_<provider>_calls / _errors / _in / _out                    per provider
 *   m_<model>_calls / _in / _out                                 per model
 *   j_<job>_calls, t_<task>_calls                                per job type (live/bulk) and per task name
 * Writes never fail a request.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';

export class AiCapError extends Error { constructor(m: string) { super(m); this.name = 'AiCapError'; } }

export const bulkDailyCap = () => { const n = Number(process.env.AI_BULK_DAILY_CAP); return Number.isFinite(n) && n > 0 ? n : 2000; };
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const safe = (s: string) => String(s || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);

let capCache: { day: string; n: number; at: number } | null = null;

export interface AiCallLog { provider: string; model?: string; job: 'live' | 'bulk'; task?: string; tokensIn?: number; tokensOut?: number; ms?: number; ok: boolean; fallback?: boolean; error?: string }

export async function recordAiCall(c: AiCallLog): Promise<void> {
  try {
    const inc = (n: number) => FieldValue.increment(n);
    const p = `p_${safe(c.provider)}`;
    const d: Record<string, any> = {
      day: dayKey(), calls: inc(1), [`${p}_calls`]: inc(1), [`j_${c.job}_calls`]: inc(1),
      tokensIn: inc(c.tokensIn || 0), tokensOut: inc(c.tokensOut || 0), ms: inc(c.ms || 0),
      [`${p}_in`]: inc(c.tokensIn || 0), [`${p}_out`]: inc(c.tokensOut || 0),
    };
    if (c.job === 'bulk') d.bulkCalls = inc(1);
    if (!c.ok) { d.errors = inc(1); d[`${p}_errors`] = inc(1); d.lastError = String(c.error || '').slice(0, 200); d.lastErrorAt = new Date().toISOString(); }
    if (c.fallback) d.fallbacks = inc(1);
    if (c.model) { const m = `m_${safe(c.model)}`; d[`${m}_calls`] = inc(1); d[`${m}_in`] = inc(c.tokensIn || 0); d[`${m}_out`] = inc(c.tokensOut || 0); }
    if (c.task) d[`t_${safe(c.task)}_calls`] = inc(1);
    await getAdminDb().collection('aiUsage').doc(dayKey()).set(d, { merge: true });
    if (c.job === 'bulk' && capCache?.day === dayKey()) capCache.n += 1;
  } catch { /* usage counting must never break an AI call */ }
}

/** Throws AiCapError when today's background AI calls reached the cap. Reads one small document, cached for 30 seconds. */
export async function assertBulkAllowed(): Promise<void> {
  try {
    const day = dayKey();
    if (!capCache || capCache.day !== day || Date.now() - capCache.at > 30_000) {
      const s = await getAdminDb().collection('aiUsage').doc(day).get();
      capCache = { day, n: Number((s.data() as any)?.bulkCalls || 0), at: Date.now() };
    }
    if (capCache.n >= bulkDailyCap()) throw new AiCapError(`The daily limit for background AI work (${bulkDailyCap()} calls) is reached. It continues tomorrow, or raise AI_BULK_DAILY_CAP.`);
  } catch (e) { if (e instanceof AiCapError) throw e; /* if the counter cannot be read, allow the call */ }
}
export const __resetAiUsageCache = () => { capCache = null; };

export async function listAiUsage(days = 30): Promise<any[]> {
  const snap = await getAdminDb().collection('aiUsage').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => b.id.localeCompare(a.id)).slice(0, days);
}
