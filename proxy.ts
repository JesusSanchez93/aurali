import { updateSession } from '@/lib/supabase/proxy';
import { type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // First, run the internationalization middleware
  const response = intlMiddleware(request);

  // Then, run the Supabase session update middleware, passing the response
  // if it was modified by next-intl (e.g. adding headers or redirects)
  return await updateSession(request, response);
}

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Static files (_next/static, _next/image, etc.)
  // - Favicon and other assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|apple-touch-icon.png|.*\\.svg).*)']
};
