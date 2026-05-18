/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress font stylesheet fetch warnings during build (fonts load at runtime)
  optimizeFonts: false,
  // Tell Next.js to bundle firebase-admin and grpc modules server-side only
  // This eliminates the protobufjs/grpc webpack warning
  experimental: {
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@firebase/firestore',
      '@grpc/grpc-js',
      '@grpc/proto-loader',
      'google-gax',
    ],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
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
