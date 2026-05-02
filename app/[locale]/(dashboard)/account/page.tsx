import { getAccountProfile } from './actions';
import AccountProfileSection from '@/components/app/settings/account-profile-section';
import { getLocale } from 'next-intl/server';

export default async function AccountPage() {
  const locale = await getLocale();
  const { profile, memberships, catalogDocuments, orgData } = await getAccountProfile();

  const documentTypeOptions = catalogDocuments.map((d: { slug: string; name: Record<string, string> }) => ({
    value: d.slug,
    label: d.name?.[locale] ?? d.name?.es ?? d.slug,
  }));

  const orgMemberships = memberships.map((m: {
    role: string;
    active: boolean;
    organizations: { id: string; name: string } | null;
  }) => ({
    orgId: m.organizations?.id ?? '',
    orgName: m.organizations?.name ?? '—',
    role: m.role,
    active: m.active,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <AccountProfileSection
        profile={{
          firstname: profile?.firstname ?? '',
          lastname: profile?.lastname ?? '',
          email: profile?.email ?? '',
          phone: profile?.phone ?? '',
          document_type: profile?.document_type ?? '',
          document_number: profile?.document_number ?? '',
          professional_card_number: profile?.professional_card_number ?? null,
          professional_card_country: profile?.professional_card_country ?? null,
          professional_card_region: profile?.professional_card_region ?? null,
          professional_card_city: profile?.professional_card_city ?? null,
          signature_url: profile?.signature_url ?? null,
        }}
        documentTypeOptions={documentTypeOptions}
        memberships={orgMemberships}
        orgData={orgData ?? null}
      />
    </div>
  );
}
