import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminStorage } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
// Customers may only upload return photos; everything else is admin-only. Folder names are a fixed whitelist.
const CUSTOMER_FOLDERS = ['returns'];
const ADMIN_FOLDERS = ['returns', 'products', 'categories', 'banners', 'bundles', 'uploads'];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to upload files.' }, { status: 401 });
  const isAdmin = String(session.user.role).toLowerCase() === 'admin';

  try {
    let buffer: Buffer, type: string, folder: string;
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
      type = file.type; buffer = Buffer.from(await file.arrayBuffer()); folder = String(fd.get('folder') || 'uploads');
    }

    if (!TYPES[type]) return NextResponse.json({ error: 'Only JPG, PNG, WebP or GIF images are allowed.' }, { status: 400 });
    if (buffer.length > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 5 MB).' }, { status: 400 });
    if (!(isAdmin ? ADMIN_FOLDERS : CUSTOMER_FOLDERS).includes(folder))
      return NextResponse.json({ error: 'You are not allowed to upload here.' }, { status: 403 });

    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${TYPES[type]}`;
    const bucket = getAdminStorage().bucket();
    await bucket.file(fileName).save(buffer, { metadata: { contentType: type }, public: true });
    return NextResponse.json({ success: true, url: `https://storage.googleapis.com/${bucket.name}/${fileName}`, fileName });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
