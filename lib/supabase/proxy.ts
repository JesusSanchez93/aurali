import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export async function updateSession(request: NextRequest, response?: NextResponse) {
  let supabaseResponse = response || NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = response || NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const pathname = request.nextUrl.pathname;

  // Extract locale from pathname if present
  const segments = pathname.split('/');
  const locale = routing.locales.find(l => l === segments[1]) || routing.defaultLocale;
  const pathWithoutLocale = segments[1] === locale ? '/' + segments.slice(2).join('/') : pathname;

  const isPublicRoute =
    pathWithoutLocale === '/' ||
    pathWithoutLocale.startsWith('/login') ||
    pathWithoutLocale.startsWith('/auth') ||
    pathWithoutLocale.startsWith('/legal-process/validate-token') ||
    pathWithoutLocale.startsWith('/legal-process/client-side') ||
    pathWithoutLocale.startsWith('/legal-process/form-unavailable') ||
    pathWithoutLocale === '/link-expired';

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    // Use the detected locale for the redirect
    url.pathname = `/${locale}/auth/login`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
