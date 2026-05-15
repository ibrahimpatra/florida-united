import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { Providers } from '@/components/layout/Providers';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';

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
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

        {/* ── Google Translate — invisible integration ── */}
        {/* The actual widget div — hidden by CSS, but must exist in DOM */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Hide every part of the Google Translate widget */
          #google_translate_element,
          #google_translate_element *,
          .goog-te-banner-frame,
          .goog-te-balloon-frame,
          .goog-te-ftab-frame,
          .skiptranslate,
          .goog-te-spinner-pos {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
          }

          /* Remove the top bar Google Translate adds to the page */
          body { top: 0 !important; }
          .goog-te-banner-frame.skiptranslate { display: none !important; }

          /* Prevent GT from changing font on Arabic */
          .translated-ltr *, .translated-rtl * {
            font-family: inherit !important;
          }

          /* When Arabic active, flip layout to RTL */
          html[lang="ar"] body,
          html.arabic-active body {
            direction: rtl;
            text-align: right;
          }

          /* Restore LTR for code blocks, inputs, numbers */
          html.arabic-active input[type="number"],
          html.arabic-active input[type="tel"],
          html.arabic-active input[type="email"],
          html.arabic-active code,
          html.arabic-active pre {
            direction: ltr;
          }

          /* Smooth transition when language changes */
          body { transition: opacity 0.15s ease; }
          body.gt-translating { opacity: 0.6; pointer-events: none; }
        `}} />
      </head>
      <body>
        {/* Hidden GT widget mount point — required by Google's script */}
        <div id="google_translate_element" style={{ display: 'none', visibility: 'hidden', height: 0, overflow: 'hidden' }} />

        <Providers>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontWeight: 600 } }}
          />
        </Providers>

        {/* ── Google Translate initialisation ── */}
        <Script
          id="gt-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Tell GT which languages and where to mount (hidden)
              window.googleTranslateElementInit = function() {
                new google.translate.TranslateElement({
                  pageLanguage: 'en',
                  includedLanguages: 'ar',
                  autoDisplay: false,
                  layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                }, 'google_translate_element');
              };

              // Expose the programmatic switcher globally
              // Usage: window.switchToArabic() / window.switchToEnglish()
              window.switchToArabic = function() {
                document.body.classList.add('gt-translating');
                // Set the googtrans cookie that GT reads
                var d = new Date();
                d.setFullYear(d.getFullYear() + 1);
                document.cookie = 'googtrans=/en/ar; expires=' + d.toUTCString() + '; path=/';
                document.cookie = 'googtrans=/en/ar; expires=' + d.toUTCString() + '; path=/; domain=' + location.hostname;
                // Apply RTL + Arabic class immediately
                document.documentElement.setAttribute('lang', 'ar');
                document.documentElement.setAttribute('dir', 'rtl');
                document.documentElement.classList.add('arabic-active');
                localStorage.setItem('fk-lang', 'ar');

                // Trigger GT to translate
                var sel = document.querySelector('.goog-te-combo');
                if (sel) {
                  sel.value = 'ar';
                  sel.dispatchEvent(new Event('change'));
                }
                setTimeout(function(){ document.body.classList.remove('gt-translating'); }, 800);
              };

              window.switchToEnglish = function() {
                document.body.classList.add('gt-translating');
                // Clear the cookie
                document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
                document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + location.hostname;
                document.documentElement.setAttribute('lang', 'en');
                document.documentElement.setAttribute('dir', 'ltr');
                document.documentElement.classList.remove('arabic-active');
                localStorage.setItem('fk-lang', 'en');

                // Restore English — GT uses /en/en to reset
                var sel = document.querySelector('.goog-te-combo');
                if (sel) {
                  sel.value = '';
                  sel.dispatchEvent(new Event('change'));
                }
                setTimeout(function(){
                  document.body.classList.remove('gt-translating');
                  // Remove GT iframe injection artifacts
                  var frame = document.querySelector('.goog-te-banner-frame');
                  if (frame) frame.remove();
                }, 800);
              };

              // On page load, restore previously chosen language
              (function() {
                var saved = localStorage.getItem('fk-lang');
                if (saved === 'ar') {
                  // Wait for GT script to be ready
                  var tries = 0;
                  var wait = setInterval(function() {
                    tries++;
                    if (tries > 20) { clearInterval(wait); return; }
                    if (window.switchToArabic) {
                      clearInterval(wait);
                      setTimeout(window.switchToArabic, 300);
                    }
                  }, 200);
                }
              })();
            `
          }}
        />

        {/* Load Google Translate script AFTER our init function is defined */}
        <Script
          id="gt-script"
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
