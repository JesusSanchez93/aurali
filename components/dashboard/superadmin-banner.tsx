import { createClient } from '@/lib/supabase/server';
import { exitOrganizationAction } from '@/app/[locale]/(dashboard)/admin/clients/actions';
import type { SessionProfile } from '@/lib/auth/get-session-profile';
import { Eye, LogOut } from 'lucide-react';

interface Props {
  profile: SessionProfile;
}

export async function SuperAdminBanner({ profile }: Props) {
  if (profile.system_role !== 'SUPERADMIN' || !profile.current_organization_id) {
    return null;
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.current_organization_id)
    .single();

  return (
    <div className="flex h-10 shrink-0 items-center justify-between bg-amber-400 px-4 shadow-sm md:px-6">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-950">
        <Eye className="size-4 shrink-0" />
        <span className="hidden sm:inline">
          Visualizando como:{' '}
          <strong className="font-bold">{org?.name ?? profile.current_organization_id}</strong>
        </span>
        <strong className="font-bold sm:hidden">{org?.name ?? profile.current_organization_id}</strong>
      </div>
      <form action={exitOrganizationAction}>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-md border border-amber-700/40 bg-amber-300 px-3 py-1 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-200"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">Regresar a mi perfil</span>
        </button>
      </form>
    </div>
  );
}
