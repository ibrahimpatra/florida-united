import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Enter your order number to see where your order is.',
  alternates: { canonical: '/order-tracking' },
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
