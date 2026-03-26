import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    viewTransition: true,
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default withNextIntl(nextConfig);
