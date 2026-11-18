'use client';
import { useBrand } from '@/contexts/BrandContext';

/** The logo inside the little rounded square: the uploaded logo if there is one, otherwise the initials. */
export function BrandMark() {
  const b = useBrand();
  // eslint-disable-next-line @next/next/no-img-element
  if (b.logoUrl) return <img src={b.logoUrl} alt="" className="h-full w-full object-contain p-1" />;
  return <>{b.logoText}</>;
}
