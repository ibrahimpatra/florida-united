import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!, Key: key, Body: body, ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable', // file names are unique, so browsers can cache forever
  }));
  return `${process.env.R2_PUBLIC_URL!.replace(/\/+$/, '')}/${key}`;
}
