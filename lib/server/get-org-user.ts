import { createClient } from '@/lib/supabase/server';

/**
 * Shared helper for server actions: returns a Supabase client together with
 * the authenticated user id and their current organization id.
 * Throws on missing auth or missing org context.
 */
export async function getOrgAndUser() {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) throw new Error('Unauthorized');

    const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.current_organization_id) throw new Error('Organization not found');

    return { supabase, userId: user.id, organizationId: profile.current_organization_id };
}
