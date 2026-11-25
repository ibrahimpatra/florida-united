import { reportIssue } from './issues';
/**
 * Background jobs, shown in Admin > Jobs (super admin).
 * Today there is one job type, "seo": when a product is saved with missing description / Arabic text / meta title / meta description / tags,
 * a job is queued and the AI fills ONLY the empty fields (it never overwrites what a person wrote).
 *
 * How jobs run on Vercel Hobby (no worker machines): a queued job is started right after the save with waitUntil (keeps running after the
 * response), at most 2 at a time. Anything still queued is picked up by the daily cron (/api/cron/jobs), by "Run queued jobs" in Admin > Jobs,
 * and automatically while the Jobs page is open.
 */
import { getAdminDb } from './firebase-admin';
import { aiConfigured, explainAi } from './ai';
import { writeProductCopy } from './product-copy';
import { SPECS, missingFields, fillEntity } from './entity-fill';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';
export interface Job { id: string; type: 'seo' | 'fill' | 'images'; collection?: string; status: JobStatus; productId: string; productName: string; attempts: number; error?: string; result?: any; provider?: string; createdAt: string; updatedAt: string }

const COL = 'jobs';
const MAX_ATTEMPTS = 3;
const STALE_RUNNING_MS = 5 * 60_000;
let running = 0;

/** Which of the AI-fillable fields are empty on this product. */
export function missingSeo(p: any): string[] {
  const m: string[] = [];
  if (String(p?.name || '').trim() && !String(p?.nameAr || '').trim()) m.push('nameAr');
  if (!String(p?.description || '').trim()) m.push('description');
  if (!String(p?.shortDescription || '').trim()) m.push('shortDescription');
  if (!String(p?.descriptionAr || '').trim()) m.push('descriptionAr');
  if (String(p?.shortDescription || '').trim() && !String(p?.shortDescriptionAr || '').trim()) m.push('shortDescriptionAr');
  if (!String(p?.metaTitle || '').trim()) m.push('metaTitle');
  if (!String(p?.metaDesc || '').trim()) m.push('metaDesc');
  if (!String(p?.metaTitleAr || '').trim()) m.push('metaTitleAr');
  if (!String(p?.metaDescAr || '').trim()) m.push('metaDescAr');
  if (!Array.isArray(p?.tags) || !p.tags.length) m.push('tags');
  return m;
}

/** Called after a product is created or saved. Never throws, never slows the save. */
export async function enqueueSeoIfMissing(productId: string): Promise<void> {
  try {
    if (!aiConfigured()) return;
    const db = getAdminDb();
    const snap = await db.collection('products').doc(productId).get();
    if (!snap.exists) return;
    const p: any = snap.data();
    if (!missingSeo(p).length) return;
    const id = `seo_${productId}`;
    const ref = db.collection(COL).doc(id);
    const cur = await ref.get();
    const iso = new Date().toISOString();
    if (cur.exists) {
      const c: any = cur.data();
      if (c.status === 'queued' || c.status === 'running') return;
      if (c.status === 'failed' && (c.attempts || 0) >= MAX_ATTEMPTS) return;  // retry by hand from Admin > Jobs
    }
    await ref.set({ type: 'seo', status: 'queued', productId, productName: String(p.name || ''), attempts: cur.exists ? (cur.data() as any).attempts || 0 : 0, createdAt: cur.exists ? (cur.data() as any).createdAt : iso, updatedAt: iso });
    if (running < 2) {
      const work = runJob(id).catch(e => reportIssue(`job ${id}`, e));
      try { (await import('@vercel/functions')).waitUntil(work); } catch { /* not on Vercel: the promise just keeps running */ }
    }
  } catch (e) { reportIssue('job enqueue', e); /* a background job must never break a save */ }
}

/** Same as enqueueSeoIfMissing for categories, banners, flash deals, bundles, promo tiles and popups. Never throws. */
export async function enqueueFill(collection: string, entityId: string): Promise<void> {
  try {
    const spec = SPECS[collection]; if (!spec || !aiConfigured()) return;
    const db = getAdminDb();
    const snap = await db.collection(collection).doc(entityId).get(); if (!snap.exists) return;
    const doc: any = snap.data();
    if (!missingFields(spec, doc).length) return;
    const id = `fill_${collection}_${entityId}`; const ref = db.collection(COL).doc(id); const cur = await ref.get(); const iso = new Date().toISOString();
    if (cur.exists) { const c: any = cur.data(); if (c.status === 'queued' || c.status === 'running') return; if (c.status === 'failed' && (c.attempts || 0) >= MAX_ATTEMPTS) return; }
    await ref.set({ type: 'fill', collection, status: 'queued', productId: entityId, productName: String(doc[spec.nameField] || ''), attempts: cur.exists ? (cur.data() as any).attempts || 0 : 0, createdAt: cur.exists ? (cur.data() as any).createdAt : iso, updatedAt: iso });
    if (running < 2) {
      const work = runJob(id).catch(e => reportIssue(`job ${id}`, e));
      try { (await import('@vercel/functions')).waitUntil(work); } catch { /* not on Vercel */ }
    }
  } catch (e) { reportIssue('job enqueue', e); /* a background job must never break a save */ }
}

/** Runs one job. Safe to call twice: the status check inside a transaction lets only one runner start it. */
/** Queues "copy this product's linked pictures onto our storage" jobs (one per product; no AI involved). */
export async function enqueueImageCopies(productIds: string[]): Promise<number> {
  const db = getAdminDb(); const iso = new Date().toISOString(); const ids = [...new Set(productIds)];
  for (let i = 0; i < ids.length; i += 400) {
    const batch = db.batch();
    ids.slice(i, i + 400).forEach(id => batch.set(db.collection(COL).doc(`images_${id}`), { type: 'images', status: 'queued', productId: id, productName: '', attempts: 0, error: '', createdAt: iso, updatedAt: iso }));
    await batch.commit();
  }
  return ids.length;
}

export async function runJob(id: string): Promise<Job | null> {
  const db = getAdminDb(); const ref = db.collection(COL).doc(id);
  const claimed = await db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref); if (!s.exists) return null;
    const j: any = s.data();
    const stale = j.status === 'running' && Date.now() - new Date(j.updatedAt).getTime() > STALE_RUNNING_MS;
    if (j.status !== 'queued' && !stale) return null;
    tx.update(ref, { status: 'running', attempts: (j.attempts || 0) + 1, updatedAt: new Date().toISOString() });
    return j;
  });
  if (!claimed) return null;
  running++;
  const finish = async (patch: any) => { await ref.update({ ...patch, updatedAt: new Date().toISOString() }); };
  try {
    if (claimed.type === 'images') {
      const { isExternalImage, ingestImage } = await import('./image-ingest');
      const pRef = db.collection('products').doc(claimed.productId); const snap = await pRef.get();
      if (!snap.exists) { await finish({ status: 'failed', error: 'The product no longer exists.', attempts: MAX_ATTEMPTS }); return null; }
      const p: any = snap.data(); const imgs: string[] = Array.isArray(p.images) ? p.images : [];
      const todo = imgs.filter(isExternalImage);
      if (!todo.length) { await finish({ status: 'done', productName: String(p.name || ''), result: { copied: 0, note: 'Nothing to copy.' } }); return null; }
      const next: string[] = []; let copied = 0; const failed: string[] = [];
      for (const u of imgs) {
        if (!isExternalImage(u)) { next.push(u); continue; }
        try { next.push(await ingestImage(u, String(p.sku || p.name || ''))); copied++; }
        catch (e: any) { next.push(u); failed.push(`${u.slice(0, 80)}: ${String(e?.message || e).slice(0, 120)}`); }   // keep the original link so the product still has a picture
      }
      // only the pictures changed; re-read the product first so edits made while we were downloading are not overwritten
      const fresh = (await pRef.get()).data() as any;
      const cur: string[] = Array.isArray(fresh?.images) ? fresh.images : imgs;
      const map = new Map(imgs.map((o, i) => [o, next[i]]));
      await pRef.update({ images: cur.map(u => map.get(u) ?? u), updatedAt: new Date().toISOString() });
      try { (await import('./firestore-admin')).invalidateProductCache?.(false, { ids: [claimed.productId] }); } catch { /* refreshes on its own */ }
      // a picture that could not be fetched is a final answer for this link: do not retry forever
      await finish({ status: failed.length && !copied ? 'failed' : 'done', productName: String(p.name || ''), attempts: failed.length && !copied ? MAX_ATTEMPTS : claimed.attempts + 1, error: failed.join(' | ').slice(0, 400), result: { copied, failed: failed.length } });
      return null;
    }
    if (claimed.type === 'fill' && claimed.collection) {
      const spec = SPECS[claimed.collection]; const eRef = db.collection(claimed.collection).doc(claimed.productId); const es = await eRef.get();
      if (!spec || !es.exists) { await finish({ status: 'failed', error: 'The item no longer exists.', attempts: MAX_ATTEMPTS }); return null; }
      const keys = missingFields(spec, es.data());
      if (!keys.length) { await finish({ status: 'done', result: { filled: [], note: 'Nothing was missing.' } }); return null; }
      const { patch, provider } = await fillEntity(spec, es.data(), keys, { job: 'bulk' });
      if (!Object.keys(patch).length) throw new Error('The AI returned nothing usable.');
      await eRef.update({ ...patch, autoFilledAt: new Date().toISOString() });
      if (claimed.collection === 'categories') { try { (await import('./firestore-admin')).invalidateProductCache?.(true, { cats: true }); } catch { /* refreshes on its own */ } }
      await finish({ status: 'done', provider, error: '', result: { filled: Object.keys(patch) } });
      return null;
    }
    const ps = await db.collection('products').doc(claimed.productId).get();
    if (!ps.exists) { await finish({ status: 'failed', error: 'The product no longer exists.', attempts: MAX_ATTEMPTS }); return null; }
    const p: any = ps.data();
    const missing = missingSeo(p);
    if (!missing.length) { await finish({ status: 'done', result: { filled: [], note: 'Nothing was missing.' } }); return null; }
    const { fields, tags, provider } = await writeProductCopy({
      name: p.name, nameAr: p.nameAr, brand: p.brand, category: p.categoryName, sku: p.sku, tags: p.tags, existing: p.description,
    }, { job: 'bulk' });
    const patch: Record<string, any> = {};
    for (const k of missing) { if (k === 'nameAr' || k === 'shortDescriptionAr') { if (fields[k]) patch[k] = fields[k]; } else if (k === 'tags') { if (tags.length) patch.tags = tags; } else if (fields[k]) patch[k] = fields[k]; }
    if (!Object.keys(patch).length) throw new Error('The AI returned nothing usable.');
    await db.collection('products').doc(claimed.productId).update({ ...patch, seoAutoFilledAt: new Date().toISOString() });
    try { (await import('./firestore-admin')).invalidateProductCache?.(true, { ids: [claimed.productId] }); } catch { /* cache refreshes on its own */ }   // only this product is re-read
    await finish({ status: 'done', provider, error: '', result: { filled: Object.keys(patch) } });
  } catch (e: any) {
    if (e?.name === 'AiCapError') { await finish({ status: 'queued', attempts: claimed.attempts || 0, error: String(e.message).slice(0, 300) }).catch(() => {}); return null; }
    const attempts = (claimed.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) reportIssue(`job ${id} failed`, explainAi(e), { method: 'JOB' });
    await finish({ status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', error: explainAi(e) }).catch(() => {});
  } finally { running--; }
  return null;
}

export async function listJobs(limit = 100): Promise<Job[]> {
  // newest first and capped: the page must never read the whole job history (hundreds of documents) every time it refreshes
  const snap = await getAdminDb().collection(COL).orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Job));
}

/** Runs queued jobs one after another until the time budget is used. Returns how many were processed. */
export async function runQueued(budgetMs = 40_000): Promise<{ ran: number; left: number }> {
  const t0 = Date.now(); let ran = 0;
  // read only the waiting jobs (and stuck ones), not the whole job history: this runs every few minutes, so reads matter
  const col = getAdminDb().collection(COL);
  const rows = (s: any) => s.docs.map((d: any) => ({ id: d.id, ...d.data() } as Job));
  const [q, r] = await Promise.all([col.where('status', '==', 'queued').limit(30).get(), col.where('status', '==', 'running').limit(50).get()]);
  const all = [...rows(q), ...rows(r).filter((j: Job) => Date.now() - new Date(j.updatedAt).getTime() > STALE_RUNNING_MS)];
  if (all.some((j: Job) => j.type !== 'images')) { try { await (await import('./ai-usage')).assertBulkAllowed(); } catch (e: any) { if (e?.name === 'AiCapError') return { ran: 0, left: all.length }; } }
  for (const j of all) {
    if (Date.now() - t0 > budgetMs - 12_000) break;
    await runJob(j.id); ran++;
  }
  return { ran, left: Math.max(0, all.length - ran) };
}

export async function retryJob(id: string) {
  await getAdminDb().collection(COL).doc(id).update({ status: 'queued', attempts: 0, error: '', updatedAt: new Date().toISOString() });
}
/** Queues an SEO job for every product that is missing something. Returns how many were queued. */
export async function queueAllMissing(max = 100): Promise<number> {
  let extra = 0;
  for (const c of Object.keys(SPECS)) {
    const snap = await getAdminDb().collection(c).get();
    for (const d of snap.docs) {
      if (extra >= max) break; if (!missingFields(SPECS[c], d.data()).length) continue;
      const id = `fill_${c}_${d.id}`; const ref = getAdminDb().collection(COL).doc(id); const cur = await ref.get();
      if (cur.exists && ['queued', 'running'].includes((cur.data() as any).status)) continue;
      const iso = new Date().toISOString();
      await ref.set({ type: 'fill', collection: c, status: 'queued', productId: d.id, productName: String((d.data() as any)[SPECS[c].nameField] || ''), attempts: 0, createdAt: iso, updatedAt: iso }); extra++;
    }
  }
  const snap = await getAdminDb().collection('products').get();
  let n = 0;
  for (const d of snap.docs) {
    if (n >= max) break;
    if (!missingSeo(d.data()).length) continue;
    const id = `seo_${d.id}`; const ref = getAdminDb().collection(COL).doc(id);
    const cur = await ref.get();
    if (cur.exists && ['queued', 'running'].includes((cur.data() as any).status)) continue;
    const iso = new Date().toISOString();
    await ref.set({ type: 'seo', status: 'queued', productId: d.id, productName: String((d.data() as any).name || ''), attempts: 0, createdAt: iso, updatedAt: iso }); n++;
  }
  return n + extra;
}
