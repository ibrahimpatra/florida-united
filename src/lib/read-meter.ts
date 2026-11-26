/**
 * Counts Firestore document reads per API route, so "why is the usage so high?" has an answer.
 * Patches the Firestore client once (reads are what Firebase bills for). A route that reads a lot logs one line:
 *   [reads] GET /api/xyz used 120 database reads
 * Counters live in this server's memory (Vercel may run several servers; the Firebase Usage tab is the grand total).
 */
import { Query, DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import { reqStore } from './request-context';

interface Row { calls: number; reads: number; max: number }
const g = globalThis as any;
export const meter: { since: number; total: number; other: number; routes: Map<string, Row> } = (g.__fkMeter ??= { since: Date.now(), total: 0, other: 0, routes: new Map() });

export function countReads(n: number) {
  if (!(n > 0)) return;
  meter.total += n;
  const s = reqStore.getStore() as any;
  if (s) s.reads = (s.reads || 0) + n; else meter.other += n;   // no request around it: a page render or a background job
}

export function recordRoute(key: string, reads: number) {
  const r = meter.routes.get(key) || { calls: 0, reads: 0, max: 0 };
  r.calls++; r.reads += reads; r.max = Math.max(r.max, reads);
  meter.routes.set(key, r);
  if (reads >= 40) console.log(`[reads] ${key} used ${reads} database reads`);
}

export function resetMeter() { meter.since = Date.now(); meter.total = 0; meter.other = 0; meter.routes.clear(); }

if (!g.__fkMeterPatched) {
  g.__fkMeterPatched = true;
  const wrap = (proto: any, name: string, count: (args: any[], out: any) => number) => {
    const orig = proto?.[name]; if (typeof orig !== 'function') return;
    proto[name] = async function (...args: any[]) { const out = await orig.apply(this, args); try { countReads(count(args, out)); } catch { /* never break a read */ } return out; };
  };
  const snapReads = (out: any) => (out && typeof out.size === 'number' ? Math.max(1, out.size) : 1);
  const refs = (args: any[]) => args.filter(a => a && typeof a.path === 'string').length;
  try {
    wrap(Query.prototype, 'get', (_a, out) => snapReads(out));
    wrap(DocumentReference.prototype, 'get', () => 1);
    wrap(Firestore.prototype, 'getAll', a => refs(a));
    wrap(Transaction.prototype, 'get', (a, out) => (a[0] && typeof a[0].path === 'string' && !('docs' in (out || {})) ? 1 : snapReads(out)));
    wrap(Transaction.prototype, 'getAll', a => refs(a));
  } catch { /* the meter is optional */ }
}
