import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchFileToSku } from '../src/lib/photo-match';
import { isExternalImage, isPrivateAddress } from '../src/lib/image-ingest';

const skus = new Map([['led-50w', 'LED-50W'], ['pipe-2', 'PIPE-2'], ['a1', 'A1']]);

test('file names map to SKU and picture order', () => {
  assert.deepEqual(matchFileToSku('LED-50W.jpg', skus), { sku: 'LED-50W', order: 1 });
  assert.deepEqual(matchFileToSku('led-50w-2.PNG', skus), { sku: 'LED-50W', order: 2 });
  assert.deepEqual(matchFileToSku('LED-50W_3.webp', skus), { sku: 'LED-50W', order: 3 });
  assert.deepEqual(matchFileToSku('A1 (2).jpg', skus), { sku: 'A1', order: 2 });
  assert.deepEqual(matchFileToSku('PIPE-2.jpg', skus), { sku: 'PIPE-2', order: 1 });   // the whole name is a SKU
  assert.equal(matchFileToSku('unknown-1.jpg', skus), null);
});

test('only links to other sites are copied; private addresses are refused', () => {
  assert.equal(isExternalImage('https://cdn.shop.com/a.jpg'), true);
  assert.equal(isExternalImage('/media/products/x.webp'), false);
  assert.equal(isExternalImage('https://pub-abc.r2.dev/products/x-abc123.webp'), false);   // our own old storage link
  assert.equal(isExternalImage(''), false);
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
});
