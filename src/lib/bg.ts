/** Starts the "fill blank Arabic / SEO text" background job for one saved item. Runs after the response on Vercel; never throws. */
export function queueFill(collection: string, id: string) {
  const work = import('./jobs').then(m => m.enqueueFill(collection, id)).catch(() => {});
  import('@vercel/functions').then(v => v.waitUntil(work)).catch(() => {});
}

/** Keeps a promise alive after the response is sent (Vercel waitUntil), so a log entry is never lost or written late. Never throws. */
export function keepAlive(work: Promise<any>) {
  const safe = work.catch(() => {});
  try { import('@vercel/functions').then(v => v.waitUntil(safe)).catch(() => {}); } catch { /* not on Vercel */ }
  return safe;
}
