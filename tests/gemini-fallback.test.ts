import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { generate, GeminiError } from '../src/lib/gemini';
const real = global.fetch;
beforeEach(() => { process.env.GEMINI_API_KEY = 'k'; delete process.env.GEMINI_MODEL; });
afterEach(() => { global.fetch = real; });

const respond = (status: number, body: any = {}) => new Response(JSON.stringify(status === 200 ? body : { error: { message: body.msg || 'x' } }), { status });

test('busy model (503) moves to the next model and the answer still arrives', async () => {
  const tried: string[] = [];
  global.fetch = (async (url: any) => { const m = String(url).match(/models\/([^:]+):/)![1]; tried.push(m); return m === 'gemini-3.8-flash' ? respond(503, { msg: 'high demand' }) : respond(200, { ok: m }); }) as any;
  const r = await generate({ contents: [] });
  assert.equal(r.ok, 'gemini-3.6-flash'); assert.deepEqual(tried, ['gemini-3.8-flash', 'gemini-3.6-flash']);
});
test('a bad API key stops at once; no model will fix it', async () => {
  let calls = 0; global.fetch = (async () => { calls++; return respond(403, { msg: 'denied' }); }) as any;
  await assert.rejects(() => generate({}), (e: any) => e instanceof GeminiError && e.status === 403);
  assert.equal(calls, 1);
});
test('network failure on one model falls through to the next', async () => {
  let n = 0; global.fetch = (async () => { if (n++ === 0) throw new TypeError('fetch failed'); return respond(200, { ok: 1 }); }) as any;
  assert.equal((await generate({})).ok, 1);
});
