import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { adminGetProducts } from '../src/lib/firestore-admin';
import { normSearch, suggestQuery, matchScore } from '../src/lib/pricing';

let db: FakeDb;
const P = (o: any) => ({ price: 5, stock: 10, isActive: true, createdAt: '2026-01-01', ...o });
beforeEach(() => {
  db = new FakeDb(); __setAdminDbForTests(db);
  db.seed('products', 'a', P({ name: 'Circuit Breaker 20A', nameAr: 'قاطع كهربائي', brand: 'Schneider', price: 12 }));
  db.seed('products', 'b', P({ name: 'Wall Socket', nameAr: 'مقبس حائط', brand: 'Legrand', price: 3 }));
  db.seed('products', 'c', P({ name: 'Socket Cover', brand: 'Legrand', price: 1, stock: 0 }));
  db.seed('products', 'd', P({ name: 'Hammer', nameAr: 'مطرقة', brand: 'Stanley', price: 8 }));
});

test('Arabic spellings are compared the same way (alef, ya, ta marbuta, diacritics, digits)', () => {
  assert.equal(normSearch('أَدَاة'), normSearch('اداه'));
  assert.equal(normSearch('٢٠'), '20');
  assert.ok(matchScore({ nameAr: 'مقبس حائط' }, 'مقبس') > 0);
  assert.ok(matchScore({ nameAr: 'مكبس مياه' }, 'مكبس') > 0);
});

test('suggestQuery fixes typos in English and Arabic, leaves good queries alone', () => {
  const vocab = ['circuit', 'breaker', 'socket', 'hammer', 'مطرقة', 'مقبس'];
  assert.equal(suggestQuery(vocab, 'sokcet'), 'socket');
  assert.equal(suggestQuery(vocab, 'circiut brekaer'), 'circuit breaker');
  assert.equal(suggestQuery(vocab, 'socket'), null);
  assert.equal(suggestQuery(vocab, 'مطرقه'), null);                // same word, different ta marbuta: already matches
  assert.equal(suggestQuery(vocab, 'مقبص'), 'مقبس');
  assert.equal(suggestQuery(vocab, 'zzzzzz'), null);
});

test('shop search: typo gives "did you mean", filters and brand list work', async () => {
  const none: any = await adminGetProducts({ search: 'hamer' } as any);
  assert.ok(none.total === 1 || none.didYouMean === 'hammer');   // one-letter typo may still match; never an empty page without a hint
  const lost: any = await adminGetProducts({ search: 'sokcet' } as any);
  assert.equal(lost.total, 0); assert.equal(lost.didYouMean, 'socket');
  const s: any = await adminGetProducts({ search: 'socket' } as any);
  assert.equal(s.total, 2); assert.deepEqual(s.brands, [{ name: 'Legrand', count: 2 }]);
  const inStock: any = await adminGetProducts({ search: 'socket', inStock: true } as any); assert.equal(inStock.total, 1);
  assert.equal(inStock.brands[0].count, 2);                       // brand list is not narrowed by the stock filter
  const price: any = await adminGetProducts({ minPrice: 4, maxPrice: 10 } as any); assert.deepEqual(price.items.map((p: any) => p.id).sort(), ['d']);
  const brand: any = await adminGetProducts({ brand: 'stanley' } as any); assert.equal(brand.total, 1);
  assert.equal((await adminGetProducts({ search: 'qqqqqq' } as any) as any).didYouMean, undefined);
});
