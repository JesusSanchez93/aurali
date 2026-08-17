import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const securityHeaders = [
  // A05 — Clickjacking (X-Frame-Options redundant with CSP frame-ancestors, but kept for older browsers)
  { key: 'X-Frame-Options', value: 'DENY' },
  // A05 — MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // A02 — Limit referrer info sent to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // A05 — Disable unnecessary browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=()' },
  // A05 — Content Security Policy
  // unsafe-inline required: Next.js hydration scripts + TipTap inline styles
  // unsafe-eval required: Next.js dev mode (remove in prod if possible)
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      // Supabase realtime + storage + auth, Sentry tunneled via /monitoring
      // Local Supabase (dev only) speaks plain http/ws on 127.0.0.1:54321
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com ${process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:54321 ws://127.0.0.1:54321' : ''} ${process.env.NEXT_PUBLIC_APP_URL ?? ''}`,
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'aurali',

  project: 'javascript-nextjs',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
