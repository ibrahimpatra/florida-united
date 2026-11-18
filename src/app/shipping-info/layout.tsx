import { altLinks } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping and delivery',
  description: 'Delivery areas, costs and times across Kuwait.',
  alternates: altLinks('/shipping-info'),
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
