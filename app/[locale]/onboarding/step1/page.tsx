import Step1Form from '@/components/app/onboarding/step1-form';
import { createClient } from '@/lib/supabase/server';
import { getLocale } from 'next-intl/server';

export default async function Step1Page() {
  const supabase = await createClient();
  const locale = await getLocale();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: profile }, { data: catalogDocuments }] = await Promise.all([
    db
      .from('profiles')
      .select('firstname, lastname, email, phone, document_type, document_number, professional_card_number, professional_card_country, professional_card_region, professional_card_city, current_organization_id')
      .eq('id', user.id)
      .single(),
    db
      .from('catalog_documents')
      .select('slug, name')
      .eq('is_active', true)
      .order('slug'),
  ]);

  // Detect invited users: their org was created by someone else
  let isInvited = false;
  if (profile?.current_organization_id) {
    const { data: org } = await db
      .from('organizations')
      .select('created_by')
      .eq('id', profile.current_organization_id)
      .single();
    isInvited = org?.created_by !== user.id;
  }

  const documentTypeOptions = (catalogDocuments ?? []).map((d: { slug: string; name: Record<string, string> }) => ({
    value: d.slug,
    label: d.name?.[locale] ?? d.name?.es ?? d.slug,
  }));

  return (
    <Step1Form
      isInvited={isInvited}
      documentTypeOptions={documentTypeOptions}
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
      }}
    />
  );
}
