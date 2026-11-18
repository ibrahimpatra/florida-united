import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminStorage } from '@/lib/firebase-admin';
import sharp from 'sharp';
import { r2Enabled, uploadToR2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
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

    if (r2Enabled()) {
      // Shrink before storing: max 1600px wide, WebP. Keeps storage (and page loads) small. GIFs are kept as-is.
      let out = buffer, outType = type, ext = TYPES[type];
      if (type !== 'image/gif') {
        try {
          out = await sharp(buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
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

export const POST = withLog('POST', '/api/upload', __POST);
