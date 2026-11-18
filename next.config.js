/** @type {import('next').NextConfig} */
// Host of the Cloudflare R2 public bucket address (R2_PUBLIC_URL), so next/image may load it.
let r2Host = null;
try { if (process.env.R2_PUBLIC_URL) r2Host = new URL(process.env.R2_PUBLIC_URL).hostname; } catch (e) {}
const nextConfig = {
  // Suppress font stylesheet fetch warnings during build (fonts load at runtime)
  optimizeFonts: false,
  // Tell Next.js to bundle firebase-admin and grpc modules server-side only
  // This eliminates the protobufjs/grpc webpack warning
  experimental: {
    instrumentationHook: true, // src/instrumentation.ts checks the environment once at server start
    // the invoice PDF reads its Arabic font from disk at runtime
    outputFileTracingIncludes: { '/api/orders/[id]/invoice': ['./node_modules/pdfkit/js/data/**/*'] }, // pdfkit's built-in Helvetica metrics
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
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
      { source: '/api/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },

  async redirects() {
    return [{ source: '/home', destination: '/', permanent: true }];
  },
};

module.exports = nextConfig;
