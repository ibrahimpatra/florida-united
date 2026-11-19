import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminStorage } from '@/lib/firebase-admin';
import sharp from 'sharp';
import { r2Enabled, uploadToR2, deleteFromR2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const GIF_MAX = 1024 * 1024;
// Storage is billed by size, so every picture is shrunk to what a screen really needs.
const SIZES: Record<string, [number, number]> = { products: [1000, 72], bundles: [1000, 72], categories: [800, 74], banners: [1920, 76], brand: [1024, 85], returns: [1000, 68], uploads: [1200, 74] };
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
// Customers may only upload return photos; everything else is admin-only. Folder names are a fixed whitelist.
const CUSTOMER_FOLDERS = ['returns'];
const ADMIN_FOLDERS = ['returns', 'products', 'categories', 'banners', 'bundles', 'uploads', 'brand'];

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to upload files.' }, { status: 401 });
  const isAdmin = String(session.user.role).toLowerCase() === 'admin';

  try {
    let buffer: Buffer, type: string, folder: string;
    let fd0: FormData | null = null;
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      // { dataUrl: 'data:image/jpeg;base64,...', folder }   (used by the camera-based return flow)
      const b = await req.json();
      const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(String(b.dataUrl || ''));
      if (!m) return NextResponse.json({ error: 'Invalid image data.' }, { status: 400 });
      type = m[1].toLowerCase(); buffer = Buffer.from(m[2], 'base64'); folder = String(b.folder || 'uploads');
    } else {
      const fd = await req.formData();
      const file = fd.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file received.' }, { status: 400 });
      type = file.type; fd0 = fd; buffer = Buffer.from(await file.arrayBuffer()); folder = String(fd.get('folder') || 'uploads');
    }

    if (!TYPES[type]) return NextResponse.json({ error: 'Only JPG, PNG, WebP or GIF images are allowed.' }, { status: 400 });
    if (buffer.length > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 5 MB).' }, { status: 400 });
    if (!(isAdmin ? ADMIN_FOLDERS : CUSTOMER_FOLDERS).includes(folder))
      return NextResponse.json({ error: 'You are not allowed to upload here.' }, { status: 403 });

    // Readable file names help Google Images: products/led-flood-light-50w-k3j9x2.webp
    const hint = String((fd0?.get('name')) || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    const id = `${hint ? hint + '-' : ''}${Math.random().toString(36).slice(2, 8)}`;

    if (type === 'image/gif' && buffer.length > GIF_MAX) return NextResponse.json({ error: 'GIF too large (max 1 MB). Use a JPG or PNG instead.' }, { status: 400 });
    if (r2Enabled()) {
      // Shrink before storing (size per folder above), WebP. GIFs are kept as-is.
      const [maxW, q] = SIZES[folder] || [1200, 74];
      let out = buffer, outType = type, ext = TYPES[type];
      if (type !== 'image/gif') {
        try {
          out = await sharp(buffer).rotate().resize({ width: maxW, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer();
          outType = 'image/webp'; ext = 'webp';
        } catch { /* unreadable as an image: store the original */ }
      }
      const fileName = `${folder}/${id}.${ext}`;
      const url = await uploadToR2(fileName, out, outType);
      return NextResponse.json({ success: true, url, fileName });
    }

    // Fallback: Firebase Storage (used only while R2 is not configured)
    const fileName = `${folder}/${id}.${TYPES[type]}`;
    const bucket = getAdminStorage().bucket();
    await bucket.file(fileName).save(buffer, { metadata: { contentType: type }, public: true });
    return NextResponse.json({ success: true, url: `https://storage.googleapis.com/${bucket.name}/${fileName}`, fileName });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}

/** Admin removes an image that is no longer used, so it stops costing storage. Body: { url } */
async function __DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (String(session?.user?.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const removed = r2Enabled() ? await deleteFromR2(String(b.url || '')) : false;
  return NextResponse.json({ success: true, removed });
}

export const DELETE = withLog('DELETE', '/api/upload', __DELETE);
export const POST = withLog('POST', '/api/upload', __POST);
