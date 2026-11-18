import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isArabicPath, stripAr, toAr, hasArabicTwin } from '../src/lib/locale-path';
import { altLinks, arabicMeta } from '../src/lib/seo';
import sitemap from '../src/app/sitemap';

test('locale paths round-trip', () => {
  assert.equal(toAr('/'), '/ar'); assert.equal(toAr('/shop/x'), '/ar/shop/x'); assert.equal(toAr('/ar/shop'), '/ar/shop');
  assert.equal(stripAr('/ar'), '/'); assert.equal(stripAr('/ar/shop/x'), '/shop/x'); assert.equal(stripAr('/shop'), '/shop');
  assert.ok(isArabicPath('/ar/deals')); assert.ok(!isArabicPath('/arabic'));
});
test('only public pages have an Arabic twin', () => {
  for (const p of ['/', '/shop', '/shop/lighting', '/shop/products/x', '/deals', '/ar/about']) assert.ok(hasArabicTwin(p), p);
  for (const p of ['/checkout', '/cart', '/account/orders', '/admin', '/auth/login', '/order-tracking']) assert.ok(!hasArabicTwin(p), p);
});
test('hreflang: both versions point at each other and x-default is English', () => {
  const a: any = altLinks('/shop/x', 'en'), b: any = altLinks('/shop/x', 'ar');
  assert.equal(a.canonical, '/shop/x'); assert.equal(b.canonical, '/ar/shop/x');
  assert.deepEqual(a.languages, { en: '/shop/x', ar: '/ar/shop/x', 'x-default': '/shop/x' });
  assert.deepEqual(a.languages, b.languages);
});
test('arabicMeta swaps title, canonical and locale', () => {
  const m: any = arabicMeta({ title: 'Cable', description: 'd' }, '/shop/products/c', { title: 'كابل' });
  assert.equal(m.title.absolute, 'كابل'); assert.equal(m.alternates.canonical, '/ar/shop/products/c'); assert.equal(m.openGraph.locale, 'ar_KW');
});
test('sitemap lists both languages and no login/checkout pages', async () => {
  const s = await sitemap();
  const urls = s.map(e => e.url);
  assert.ok(urls.some(u => u.endsWith('/ar/shop')) && urls.some(u => u.endsWith('/shop')));
  assert.ok(!urls.some(u => /auth|checkout|cart|admin|order-tracking/.test(u)));
  assert.ok(s.every(e => (e as any).alternates?.languages?.ar));
});
