import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 image storage (S3-compatible). Free for the first 10 GB, no download fees.
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET. The bucket stays private; pictures are served at /media/<key>.
 * When these are not set, the upload route falls back to Firebase Storage.
 */
export function r2Enabled(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET); // R2_PUBLIC_URL is no longer needed: pictures are served from /media on your own domain
}

let client: S3Client | null = null;
export function r2Client() { return getClient(); }
function getClient() {
  if (!client) client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  return client;
}

import { fixImageUrl } from './image-url';

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: key, Body: body, ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable', // file names are unique, so browsers can cache forever
  }));
  return `/media/${key}`; // same-domain link: short, trusted by browsers, indexed by Google under your domain
}

/** Removes one stored image given its /media/... link (or an old R2 link). Returns true if it was one of ours. */
export async function deleteFromR2(url: string): Promise<boolean> {
  const fixed = fixImageUrl(String(url || ''));
  if (typeof fixed !== 'string' || !fixed.startsWith('/media/')) return false;
  const key = decodeURIComponent(fixed.slice(7).split('?')[0]);
  if (!/^(products|categories|banners|bundles|uploads|brand|brands|returns)\/[A-Za-z0-9._-]+$/.test(key)) return false;
  await getClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  return true;
}
