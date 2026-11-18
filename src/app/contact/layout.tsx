import { altLinks } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Phone, WhatsApp, email, address and opening hours.',
  alternates: altLinks('/contact'),
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
