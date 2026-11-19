import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 image storage (S3-compatible). Free for the first 10 GB, no download fees.
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 * (R2_PUBLIC_URL = the bucket's public r2.dev address or your custom domain, no trailing slash).
 * When these are not set, the upload route falls back to Firebase Storage.
 */
export function r2Enabled(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL);
}

let client: S3Client | null = null;
function getClient() {
  if (!client) client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  return client;
}

import { publicBase } from './image-url';

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: key, Body: body, ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable', // file names are unique, so browsers can cache forever
  }));
  return `${publicBase(process.env.R2_PUBLIC_URL)}/${key}`;
}

/** Removes one stored image. Only keys under our own public address are accepted. Returns true if it was ours. */
export async function deleteFromR2(url: string): Promise<boolean> {
  const base = publicBase(process.env.R2_PUBLIC_URL);
  const u = String(url || '');
  if (!base || !u.startsWith(base + '/')) return false;
  const key = decodeURIComponent(u.slice(base.length + 1).split('?')[0]);
  if (!/^(products|categories|banners|bundles|uploads|brand|returns)\/[A-Za-z0-9._-]+$/.test(key)) return false;
  await getClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  return true;
}
