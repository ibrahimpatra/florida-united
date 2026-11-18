import { altLinks } from '@/lib/seo';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { BundlesClient } from '@/components/product/BundlesClient';

export const metadata: Metadata = {
  title: 'Bundles & Kits',
  description: 'Save more with ready-made hardware and electrical kits.',
  alternates: altLinks('/bundles'),
};

export default function BundlesPage() {
  return (<><AnnouncementBar /><Header /><main><BundlesClient /></main><Footer /></>);
}
