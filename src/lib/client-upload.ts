'use client';
/**
 * Browser-side picture upload used by every form. It:
 *  1. shrinks the picture first (phone photos are 3-10 MB; Vercel refuses request bodies over 4.5 MB, which was the cause of random failures)
 *  2. retries once if the network blinks
 *  3. returns a clear message and reports the failure to Admin > Issues so it can be found later
 */
export async function shrinkImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;            // GIF / unknown: send as is
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('This picture cannot be read. Try a JPG or PNG.')); i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (k === 1 && file.size < 900 * 1024) return file;                     // already small
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/webp', quality));
    if (blob && blob.type === 'image/webp') return blob;
    return (await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', quality))) || file;
  } finally { URL.revokeObjectURL(url); }
}

async function report(folder: string, message: string, file?: Blob) {
  try {
    await fetch('/api/client-issue', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: 'upload', message: `${folder}: ${message}${file ? ` (${Math.round(file.size / 1024)} KB, ${file.type || 'unknown type'})` : ''}`, page: location.pathname }) });
  } catch { /* logging must never break the upload */ }
}

export async function uploadImage(file: Blob & { name?: string }, opts: { folder: string; name?: string; maxSide?: number }): Promise<string> {
  let body: Blob = file;
  try { body = await shrinkImage(file, opts.maxSide); }
  catch (e: any) { await report(opts.folder, e.message || 'decode failed', file); throw new Error(e.message || 'This picture cannot be read.'); }

  const attempt = async () => {
    const fd = new FormData();
    fd.append('file', body, (file as any).name || 'upload');
    fd.append('folder', opts.folder);
    if (opts.name) fd.append('name', opts.name);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const text = await res.text();
    let data: any = null; try { data = JSON.parse(text); } catch { /* not JSON: e.g. a platform error page */ }
    return { res, data, text };
  };

  let r;
  try { r = await attempt(); } catch { try { r = await attempt(); } catch (e: any) { await report(opts.folder, `network error: ${e?.message || e}`, body); throw new Error('No connection. Check your internet and try again.'); } }
  if (r.res.status >= 500) { try { r = await attempt(); } catch { /* keep the first answer */ } }

  if (r.res.ok && r.data?.url) return r.data.url as string;
  const msg = r.data?.error || (r.res.status === 413 ? 'The picture is still too large for the server. Try a smaller one.' : `Upload failed (${r.res.status}).`);
  await report(opts.folder, `HTTP ${r.res.status}: ${msg}${r.data?.adminDetail ? ` | ${r.data.adminDetail}` : ''}`, body);
  throw new Error(msg);
}
