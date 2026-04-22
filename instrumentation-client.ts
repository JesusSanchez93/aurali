// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  tracesSampleRate: 1.0,

  replaysSessionSampleRate: 0.02,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: true,
      mask: [
        'input[type="password"]',
        'input[type="email"]',
        'input[name*="document"]',
        'input[name*="phone"]',
        '.sensitive-data',
      ],
      block: [
        '.client-document-number',
        '.bank-account-info',
        '.legal-process-sensitive',
      ],
    }),
  ],

  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.Authorization;
      delete event.request.headers.Cookie;
    }
    return event;
  },

  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'NetworkError',
    'Network request failed',
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
