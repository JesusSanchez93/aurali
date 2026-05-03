import { getTranslations } from 'next-intl/server';
import { getAccountProfile } from './actions';
import AccountProfileSection from '@/components/app/settings/account-profile-section';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.user.account') };
}

async function getSignatureSignedUrl(storedUrl: string | null): Promise<string | null> {
  if (!storedUrl) return null;
  const match = storedUrl.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/?]+)\/(.+?)(?:\?|$)/);
  if (!match) return storedUrl;
  const [, bucket, path] = match;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

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
          signature_url: await getSignatureSignedUrl(profile?.signature_url ?? null),
        }}
        documentTypeOptions={documentTypeOptions}
        memberships={orgMemberships}
        orgData={orgData ?? null}
      />
    </div>
  );
}
