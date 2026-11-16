import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { Providers } from '@/components/layout/Providers';
import { AgentChat } from '@/components/agent/AgentChat';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: { default: 'Florida Kuwait', template: '%s | Florida Kuwait' },
  description: "Kuwait's premier hardware store — tools, electrical, plumbing, and building supplies.",
  keywords: ['hardware store', 'Kuwait', 'tools', 'electrical', 'building supplies'],
  openGraph: {
    type: 'website',
    locale: 'en_KW',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'Florida Kuwait',
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
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Archivo:wdth,wght@100,700;112,800&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: `
          /* RTL layout when Arabic active */
          html.arabic-active body { direction: rtl; }
          html.arabic-active input[type="number"],
          html.arabic-active input[type="tel"],
          html.arabic-active input[type="email"],
          html.arabic-active code, html.arabic-active pre { direction: ltr; }

          /* Smooth language switch */
          body { transition: opacity 0.1s ease; }

          /* Arabic: IBM Plex Sans Arabic everywhere, headings included (Archivo has no Arabic glyphs) */
          html.arabic-active body,
          html.arabic-active .font-display,
          html.arabic-active h1, html.arabic-active h2, html.arabic-active h3,
          html.arabic-active h4, html.arabic-active h5, html.arabic-active h6,
          html.arabic-active .section-title,
          html.arabic-active button, html.arabic-active input,
          html.arabic-active select, html.arabic-active textarea {
            font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
            font-stretch: 100%;
            letter-spacing: 0;
          }
        `}} />
      </head>
      <body>
        <Providers>
          {children}
          <AgentChat />
          <Toaster
            position="top-center"
            toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontWeight: 600 } }}
          />
        </Providers>
      </body>
    </html>
  );
}
