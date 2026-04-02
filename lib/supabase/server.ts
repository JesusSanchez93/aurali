import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types'


const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 *
 * Pass `{ admin: true }` to use the service role key (bypasses RLS).
 * Only use server-side for privileged operations (e.g. workflow engine).
 */
export async function createClient(options?: { admin?: boolean }) {
  if (!supabaseUrl) {
    throw new Error(
      'Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL.',
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  const supabaseKey = options?.admin
    ? process.env.SUPABASE_SECRET_KEY
    : supabaseAnonKey;

  if (!supabaseKey) {
    throw new Error(
      'Missing Supabase secret key. Set SUPABASE_SECRET_KEY for admin operations.',
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
