import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { recordIssue, listIssues, clearIssues } from '../src/lib/issues';
import { withLog } from '../src/lib/logger';

beforeEach(() => { __setAdminDbForTests(new FakeDb()); process.env.LOG_LEVEL = 'silent'; });
const settle = () => new Promise(r => setTimeout(r, 30));

test('same problem is one row with a counter; different problem is another row; clear works', async () => {
  const a = { route: '/api/x', method: 'GET', status: 500, message: 'boom' };
  await recordIssue(a); await recordIssue(a);                       // second within a minute is throttled
  await recordIssue({ ...a, message: 'other' });
  const rows = await listIssues(); assert.equal(rows.length, 2);
  assert.ok(rows.every(r => !Object.values(r).includes(undefined as any)));
  await clearIssues(rows[0].id); assert.equal((await listIssues()).length, 1);
  await clearIssues(); assert.equal((await listIssues()).length, 0);
});
test('withLog: a crash becomes a friendly 500 for shoppers (no technical text) and is saved for admins', async () => {
  const h = withLog('GET', '/api/boom', async () => { throw new Error('firestore exploded'); });
  const res: Response = await (h as any)(new Request('http://x/api/boom'));
  const j = await res.json(); assert.equal(res.status, 500);
  assert.ok(!JSON.stringify(j).includes('exploded')); assert.equal(j.adminDetail, undefined);
  await settle(); const rows = await listIssues(); assert.equal(rows.length, 1); assert.match(rows[0].message, /exploded/);
});
test('withLog: a handled 500 that only called console.error is also saved with its real reason', async () => {
  const h = withLog('POST', '/api/handled', async () => { console.error('[POST handled]', new Error('index missing')); return Response.json({ error: 'Failed' }, { status: 500 }); });
  const res: Response = await (h as any)(new Request('http://x/api/handled', { method: 'POST' }));
  assert.equal(res.status, 500); assert.equal((await res.json()).adminDetail, undefined);
  await settle(); assert.match((await listIssues())[0].message, /index missing/);
});
test('withLog: 4xx and healthy responses are not saved as issues', async () => {
  await (withLog('GET', '/api/a', async () => Response.json({ error: 'Not found' }, { status: 404 })) as any)(new Request('http://x/api/a'));
  await (withLog('GET', '/api/b', async () => Response.json({ ok: 1 })) as any)(new Request('http://x/api/b'));
  await settle(); assert.equal((await listIssues()).length, 0);
});
