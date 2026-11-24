'use client';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { forwardRef, type ComponentProps } from 'react';
import { isArabicPath, toAr, hasArabicTwin } from '@/lib/locale-path';

/** The path a link should point to on the current page: on /ar pages, public links go to their Arabic twin (checkout, account, admin stay as they are). */
export function localizePath(href: string, pathname?: string | null): string {
  if (!isArabicPath(pathname) || !href.startsWith('/') || href.startsWith('//')) return href;
  const m = href.match(/^([^?#]*)(.*)$/)!;
  return hasArabicTwin(m[1]) ? toAr(m[1]) + m[2] : href;
}
export function useLocalePath() { const p = usePathname(); return (href: string) => localizePath(href, p); }

/** Drop-in replacement for next/link that keeps shoppers on the Arabic site. */
const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function Link({ href, ...rest }, ref) {
  const p = usePathname();
  return <NextLink ref={ref} href={typeof href === 'string' ? localizePath(href, p) : href} {...rest} />;
});
export default Link;
