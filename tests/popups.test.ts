import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { sanitizePopup, popupIsLive, listPopups, createPopup, updatePopup, deletePopup, publicPopup } from '../src/lib/popups';

beforeEach(() => { __setAdminDbForTests(new FakeDb()); });

test('sanitize: requires a headline, validates link and dates, clamps numbers, no undefined', () => {
  assert.throws(() => sanitizePopup({}), /headline/);
  assert.throws(() => sanitizePopup({ title: 'x', ctaLink: 'javascript:alert(1)' }), /link/);
  assert.throws(() => sanitizePopup({ title: 'x', startsAt: '2026-02-02', endsAt: '2026-01-01' }), /end date/);
  const p = sanitizePopup({ title: ' 20% off ', couponCode: 'wel come20', delaySeconds: 9999, trigger: 'bogus', pages: ['home', 'x'], audience: 'guests' });
  assert.equal(p.couponCode, 'WELCOME20'); assert.equal(p.delaySeconds, 120); assert.equal(p.trigger, 'delay'); assert.deepEqual(p.pages, ['home']);
  assert.equal(p.name, '20% off'); assert.ok(!Object.values(p).includes(undefined as any));
});
test('schedule: live only inside its window and when active', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  assert.ok(popupIsLive({ isActive: true, startsAt: '', endsAt: '' }, now));
  assert.ok(!popupIsLive({ isActive: false, startsAt: '', endsAt: '' }, now));
  assert.ok(!popupIsLive({ isActive: true, startsAt: '2026-07-01T00:00:00Z', endsAt: '' }, now));
  assert.ok(!popupIsLive({ isActive: true, startsAt: '', endsAt: '2026-06-01T00:00:00Z' }, now));
});
test('storage: create, list live only (priority order), update, delete; shoppers never see stats', async () => {
  const a = await createPopup({ title: 'A', priority: 1 }); await createPopup({ title: 'B', priority: 5 }); await createPopup({ title: 'Off', isActive: false });
  const live = await listPopups(true);
  assert.deepEqual(live.map(p => p.title), ['B', 'A']);
  assert.equal((await listPopups(false)).length, 3);
  await updatePopup(a, { title: 'A2' }); assert.equal((await listPopups(false)).find(p => p.id === a)!.title, 'A2');
  assert.ok(!('views' in publicPopup(live[0])) && !('name' in publicPopup(live[0])));
  await deletePopup(a); assert.equal((await listPopups(false)).length, 2);
  await assert.rejects(() => updatePopup('nope', { title: 'x' }), /not found/);
});
