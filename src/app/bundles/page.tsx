import { listingSeo } from '@/lib/seo';
import { getStorefrontBundles } from '@/lib/firestore-admin';
import { baseMeta as BM } from '@/lib/listing-meta';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { BundlesClient } from '@/components/product/BundlesClient';

export const revalidate = 300;
const baseMeta = BM.bundles;
export async function generateMetadata(): Promise<Metadata> {
  let s: ReturnType<typeof listingSeo> = {};
  try { s = listingSeo(await getStorefrontBundles(), 'en'); } catch {}
  return { ...baseMeta, title: s.title || baseMeta.title, description: s.description || baseMeta.description, keywords: s.keywords };
}

export default function BundlesPage() {
  return (<><AnnouncementBar /><Header /><main><BundlesClient /></main><Footer /></>);
}
