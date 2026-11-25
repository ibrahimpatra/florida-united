'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Stops the casual ways of grabbing pictures on the shop: right-click / long-press "save image", and dragging a picture out.
 * This is a deterrent only: anyone determined can still take a screenshot or read the page source, and Google Images and
 * other search engines are not affected (they read the page and sitemap, not the mouse). Typing fields, links and the admin
 * area are never touched.
 */
export function ImageGuard() {
  const path = usePathname() || '';
  const off = path.startsWith('/admin') || path.startsWith('/ar/admin');
  useEffect(() => {
    if (off) return;
    const isPic = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'IMG' || t.tagName === 'PICTURE' || !!t.closest('img'));
    const ctx = (e: Event) => { if (isPic(e.target)) e.preventDefault(); };
    const drag = (e: Event) => { if (isPic(e.target)) e.preventDefault(); };
    document.addEventListener('contextmenu', ctx, true);
    document.addEventListener('dragstart', drag, true);
    document.body.classList.add('img-guard');
    return () => { document.removeEventListener('contextmenu', ctx, true); document.removeEventListener('dragstart', drag, true); document.body.classList.remove('img-guard'); };
  }, [off]);
  return null;
}
