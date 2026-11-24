import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Enabled, r2Client } from '@/lib/r2';
import { adminGetProductBySlug, getStorefrontBundle } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/**
 * The picture WhatsApp, Facebook, X and iMessage show when a product link is shared.
 * Chat apps do not reliably show WebP pictures, and uploads are stored as WebP, so this turns the first product picture into
 * a 1200x630 JPEG (white background, picture centred, nothing cropped). The edge keeps the result for a day, so it costs one read per product per day.
 */
async function loadOriginal(src: string): Promise<Buffer | null> {
  const m = src.match(/^\/media\/(.+)$/);
  if (m && r2Enabled()) {
    const out = await r2Client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: m[1] }));
    return out.Body ? Buffer.from(await (out.Body as any).transformToByteArray()) : null;
  }
  if (/^https:\/\//i.test(src)) {
    const r = await fetch(src, { signal: AbortSignal.timeout(8000) });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    let p: any, src: string | undefined;
    if (params.slug.startsWith('bundle-')) {            // a bundle: its own picture, else its first part's
      p = await getStorefrontBundle(params.slug.slice(7));
      src = p?.image || p?.items?.find((i: any) => i.image)?.image;
    } else { p = await adminGetProductBySlug(params.slug); src = p?.images?.[0]; }
    if (!p || p.isActive === false || !src) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
    const buf = await loadOriginal(src);
    if (!buf) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
    const jpg = await sharp(buf).rotate().resize(1200, 630, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return new NextResponse(new Uint8Array(jpg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800', 'Content-Length': String(jpg.length) } });
  } catch (e: any) {
    console.error('[share-image]', params.slug, e?.message);
    return new NextResponse('Image unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
