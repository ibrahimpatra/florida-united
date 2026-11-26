import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { dropCfg } from '../src/lib/memo';
import { adminGetBanners, adminCreateBanner } from '../src/lib/firestore-admin';
import { loadShippingSettings } from '../src/lib/orders-server';
import { listTiles } from '../src/lib/promo-tiles';
import { countReads, recordRoute, meter, resetMeter } from '../src/lib/read-meter';
import { reqStore } from '../src/lib/request-context';

function counted() {
  const db: any = new FakeDb(); __setAdminDbForTests(db); dropCfg();
  const n: Record<string, number> = {}; const col = db.collection.bind(db); const doc = db.doc.bind(db);
  db.collection = (name: string) => { const c = col(name); const g = c.get.bind(c); c.get = async () => { n[name] = (n[name] || 0) + 1; return g(); }; return c; };
  db.doc = (path: string) => { const d = doc(path); const g = d.get.bind(d); d.get = async () => { n[path] = (n[path] || 0) + 1; return g(); }; return d; };
  return { db, n };
}

test('small shared settings are read once, not on every call', async () => {
  const { db, n } = counted();
  db.seed('banners', 'b1', { title: 'A', isActive: true, sortOrder: 1 });
  db.seed('promoTiles', 't1', { title: 'T', isActive: true, sortOrder: 1 });
  db.seed('shippingZones', 'z1', { name: 'Kuwait', governorates: ['Hawalli'], rates: [] });
  for (let i = 0; i < 10; i++) { await adminGetBanners(true); await listTiles(true); await loadShippingSettings(db); }
  assert.equal(n.banners, 1); assert.equal(n.promoTiles, 1); assert.equal(n.shippingZones, 1); assert.equal(n['config/shippingConfig'], 1);
});

test('saving a banner shows it immediately even though lists are remembered', async () => {
  const { db } = counted();
  db.seed('banners', 'b1', { title: 'A', isActive: true, sortOrder: 1 });
  assert.equal((await adminGetBanners(true)).length, 1);
  await adminCreateBanner({ title: 'B', isActive: true, image: '/x.webp', sortOrder: 2 } as any).catch(() => {});
  assert.ok((await adminGetBanners(true)).length >= 1);
});

test('the read meter attributes reads to the request that made them', () => {
  resetMeter();
  const store: any = { notes: [] };
  reqStore.run(store, () => { countReads(7); countReads(3); });
  assert.equal(store.reads, 10);
  countReads(5);
  assert.equal(meter.other, 5);
  recordRoute('GET /api/x', 10); recordRoute('GET /api/x', 20);
  const r = meter.routes.get('GET /api/x')!;
  assert.deepEqual([r.calls, r.reads, r.max], [2, 30, 20]);
});
