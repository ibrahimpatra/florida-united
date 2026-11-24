import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Enabled, r2Client } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * Serves stored pictures from your own address:  https://your-site/media/products/led-light-k3j9x2.webp
 * - the link is on your domain, so browsers and security filters never see a strange storage address
 * - Google Images indexes the pictures under your domain
 * - the first request reads R2; Vercel's edge then keeps the file for a year, so repeat views cost nothing
 */
const KEY = /^(products|categories|banners|bundles|uploads|brand|brands|returns)\/[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png|gif)$/;
const TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };

export async function GET(_req: NextRequest, { params }: { params: { key: string[] } }) {
  const key = (params.key || []).map(decodeURIComponent).join('/');
  if (!KEY.test(key) || !r2Enabled()) return new NextResponse('Not found', { status: 404 });
  try {
    const out = await r2Client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
    if (!out.Body) return new NextResponse('Not found', { status: 404 });
    const ext = key.split('.').pop()!.toLowerCase();
    return new NextResponse((out.Body as any).transformToWebStream(), {
      headers: {
        'Content-Type': out.ContentType || TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ...(out.ContentLength ? { 'Content-Length': String(out.ContentLength) } : {}),
      },
    });
  } catch (e: any) {
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
    console.error('[media] read failed', key, e?.name, e?.message);
    return new NextResponse('Image unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
