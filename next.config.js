/** @type {import('next').NextConfig} */
// Host of the Cloudflare R2 public bucket address (R2_PUBLIC_URL), so next/image may load it.
let r2Host = null;
try { if (process.env.R2_PUBLIC_URL) r2Host = new URL(/^https?:\/\//i.test(process.env.R2_PUBLIC_URL.trim()) ? process.env.R2_PUBLIC_URL.trim() : 'https://' + process.env.R2_PUBLIC_URL.trim()).hostname; } catch (e) {}
const nextConfig = {
  // Suppress font stylesheet fetch warnings during build (fonts load at runtime)
  optimizeFonts: false,
  // Tell Next.js to bundle firebase-admin and grpc modules server-side only
  // This eliminates the protobufjs/grpc webpack warning
  experimental: {
    instrumentationHook: true, // src/instrumentation.ts checks the environment once at server start
    // the invoice PDF reads its Arabic font from disk at runtime
    outputFileTracingIncludes: { '/api/orders/[id]/invoice': ['./node_modules/pdfkit/js/**/*'] }, // pdfkit's built-in Helvetica metrics
    serverComponentsExternalPackages: [
      'pdfkit',
      'firebase-admin',
      '@firebase/firestore',
      '@grpc/grpc-js',
      '@grpc/proto-loader',
      'google-gax',
      'sharp',
    ],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      ...(r2Host ? [{ protocol: 'https', hostname: r2Host }] : []),
    ],
    // Uploads are already shrunk WebP files with a one-year browser cache (see upload route). Serving them directly avoids
    // Vercel's image-optimisation quota/billing and a second processing pass; the browser keeps each picture after the first view.
    unoptimized: true,
  },

  compress: true,
  poweredByHeader: false,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only modules in the client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        'firebase-admin': false,
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // private/admin APIs are never cached; the public read-only ones set their own short s-maxage so Vercel's edge answers repeat visitors
      { source: '/api/((?!products|recommendations|settings/public|bundles|categories|banners|popups|shipping/config|shipping/zones).*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      { source: '/:file(logo.svg|logo-full.svg|icon-192.png|icon-512.png|manifest.json|apple-icon.png)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
    ];
  },

  async redirects() {
    return [{ source: '/home', destination: '/', permanent: true }];
  },
};

module.exports = nextConfig;
