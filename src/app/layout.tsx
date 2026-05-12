import type { Metadata, Viewport } from 'next';
// import '../styles/globals.css';
import { Providers } from '@/components/layout/Providers';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: { default: 'Florida United Kuwait', template: '%s | Florida United Kuwait' },
  description: "Kuwait's premier hardware store — tools, electrical, plumbing, and building supplies.",
  keywords: ['hardware store', 'Kuwait', 'tools', 'electrical', 'building supplies'],
  openGraph: {
    type: 'website',
    locale: 'en_KW',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'Florida United Kuwait',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster position="top-center" toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontWeight: 600 } }} />
        </Providers>
      </body>
    </html>
  );
}