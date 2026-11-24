import type { Metadata } from 'next';
import { altLinks } from './seo';

/** Default meta for the Deals and Bundles listing pages (a Next page file may not export extra names, so they live here). */
export const baseMeta: Record<'deals' | 'bundles', Metadata> = {
  deals: { title: 'Deals & Offers', description: 'Shop the best deals on hardware, electrical supplies, safety equipment and tools. Current offers, updated daily.', alternates: altLinks('/deals') },
  bundles: { title: 'Bundles & Kits', description: 'Save more with ready-made hardware and electrical kits.', alternates: altLinks('/bundles') },
};
