import { updateSession } from '@/lib/supabase/proxy';
import { type NextRequest } from 'next/server';

export default async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|\\.well-known|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|css|js|map)$).*)',
  ],
};
