/** Starts the "fill blank Arabic / SEO text" background job for one saved item. Runs after the response on Vercel; never throws. */
export function queueFill(collection: string, id: string) {
  const work = import('./jobs').then(m => m.enqueueFill(collection, id)).catch(() => {});
  import('@vercel/functions').then(v => v.waitUntil(work)).catch(() => {});
}
