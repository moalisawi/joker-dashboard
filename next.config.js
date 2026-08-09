const isDev = process.env.NODE_ENV !== 'production'

// 'unsafe-eval' is only needed by the dev server's React Refresh runtime.
// Shipping it in production would let any injected string be executed as code,
// which is most of what a CSP is there to stop.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['firebase', '@firebase'],
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // `domains` was removed in Next 16 in favour of remotePatterns. The only
    // remote images the app loads are Firebase Storage receipt uploads.
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: '*.firebasestorage.app' },
    ],
    minimumCacheTTL: 60,
  },

  async headers() {
    return [
      // ── Security headers on every response ─────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options',        value: 'DENY' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't leak the full URL to third parties
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          // Disable browser features not used by this app
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Force HTTPS for 1 year (enable once you have a real domain + TLS)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Content Security Policy
          // firebase.googleapis.com — Auth REST
          // identitytoolkit.googleapis.com — Firebase Auth
          // firestore.googleapis.com — Firestore REST fallback
          // *.firebaseio.com — Realtime database (not used but included for SDK)
          // ip-api.com is intentionally excluded (removed in phase 3)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://firestore.googleapis.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // ── Static asset caching ────────────────────────────────────────────────
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },

  // Tree-shake heavy icon/UI libraries so each page only ships the icons it actually uses.
  // Cuts cold-compile time and shrinks the client bundle significantly.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@heroui/react',
      'recharts',
      'framer-motion',
      'date-fns',
    ],
  },

  // Custom splitChunks removed — it broke firebase subpath imports
  // (firebase/storage in particular). Next.js's default chunking + the
  // optimizePackageImports above give better results without breakage.

  // firebase/* wrappers use Object.defineProperty with dynamic getters which
  // webpack cannot statically analyze for named imports. Alias directly to
  // @firebase/* CJS implementations that use static exports assignments.
  webpack: (config) => {
    const path = require('path');
    // Use forward slashes — webpack's alias resolver normalizes on POSIX-style
    // separators, and backslashes from path.join on Windows can prevent the
    // alias from matching at all (leaving imports pointing at the dynamic-
    // getter wrapper which webpack can't statically analyze for named imports).
    const fb = path.resolve(__dirname, 'node_modules/@firebase').replace(/\\/g, '/');
    config.resolve.alias = {
      ...config.resolve.alias,
      'firebase/app':       `${fb}/app/dist/index.cjs.js`,
      'firebase/auth':      `${fb}/auth/dist/browser-cjs/index.js`,
      'firebase/firestore': `${fb}/firestore/dist/index.cjs.js`,
      'firebase/storage':   `${fb}/storage/dist/index.cjs.js`,
      'firebase/functions': `${fb}/functions/dist/index.cjs.js`,
    };
    return config;
  },
}

module.exports = nextConfig
