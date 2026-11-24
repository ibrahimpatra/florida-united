import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../src/lib/i18n/en';
import { ar } from '../src/lib/i18n/ar';

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?)$/.test(f) ? [p] : []; });
const has = (dict: any, key: string) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict) !== undefined;

test('every literal t(\'group.key\') used in the app exists in English and Arabic', () => {
  const files = walk('src').filter(f => !f.includes('/lib/i18n/'));
  const missing = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)['"]/g)) {
      if (m[1] !== 'group.key' && (!has(en, m[1]) || !has(ar, m[1]))) missing.add(`${m[1]}  (${f})`);
    }
    // SectionHeader builds its keys from `k`
    for (const m of src.matchAll(/<SectionHeader\s+k="(\w+)"/g)) {
      const k = m[1]; const sub = k === 'shopByCat' ? 'findWhat' : k === 'newArrivals' ? 'newSub' : `${k}Sub`;
      for (const key of [`c1_home.${k}`, `c1_home.${sub}`]) if (!has(en, key) || !has(ar, key)) missing.add(`${key}  (${f})`);
    }
  }
  assert.deepEqual([...missing].sort(), []);
});
