'use server';

import { createClient } from '@/lib/supabase/server';

export async function getAccountProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: profile }, { data: memberships }, { data: catalogDocuments }] = await Promise.all([
    db
      .from('profiles')
      .select('id, firstname, lastname, email, phone, document_type, document_number, professional_card_number, professional_card_country, professional_card_region, professional_card_city, signature_url, current_organization_id')
      .eq('id', user.id)
      .single(),
    db
      .from('organization_members')
      .select('role, active, organizations(id, name)')
      .eq('user_id', user.id),
    db
      .from('catalog_documents')
      .select('slug, name')
      .eq('is_active', true)
      .order('slug'),
  ]);

  // Fetch org data if user is admin of their current org
  let orgData: { id: string; name: string | null; legal_name: string | null; nit: string | null; address: string | null; country: string | null; region: string | null; city: string | null } | null = null;
  if (profile?.current_organization_id) {
    const { data: membership } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', profile.current_organization_id)
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle();
    if (membership?.role === 'ORG_ADMIN') {
      const { data: org } = await db
        .from('organizations')
        .select('id, name, legal_name, nit, address, country, region, city')
        .eq('id', profile.current_organization_id)
        .single();
      orgData = org;
    }
  }

  return { profile, memberships: memberships ?? [], catalogDocuments: catalogDocuments ?? [], orgData };
}

export async function updateAccountProfile(values: {
  firstname: string;
  lastname: string;
  phone: string;
  document_type: string;
  document_number: string;
  professional_card_number?: string;
  professional_card_country?: string;
  professional_card_region?: string;
  professional_card_city?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('profiles')
    .update({
      firstname: values.firstname,
      lastname: values.lastname,
      phone: values.phone,
      document_type: values.document_type,
      document_number: values.document_number,
      professional_card_number: values.professional_card_number ?? null,
      professional_card_country: values.professional_card_country ?? null,
      professional_card_region: values.professional_card_region ?? null,
      professional_card_city: values.professional_card_city ?? null,
    })
    .eq('id', user.id);

  if (error) throw new Error(error.message);
}

export async function updateOrganizationProfile(values: {
  orgId: string;
  name: string;
  legal_name: string;
  nit: string;
  address: string;
  country: string;
  region: string;
  city: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify user is ORG_ADMIN of this org
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', values.orgId)
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  if (membership?.role !== 'ORG_ADMIN') throw new Error('Forbidden');

  const { error } = await supabase
    .from('organizations')
    .update({
      name: values.name,
      legal_name: values.legal_name,
      nit: values.nit,
      address: values.address,
      country: values.country,
      region: values.region,
      city: values.city,
    })
    .eq('id', values.orgId);

  if (error) throw new Error(error.message);
}

export async function uploadProfileSignature(base64DataUrl: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Parse the base64 data URL (e.g. "data:image/png;base64,<data>")
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Formato de imagen inválido');
  const [, mimeType, base64Data] = match;
  const buffer = Buffer.from(base64Data, 'base64');

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'webp';

  // Remove any previous signature files so the new URL is always fresh (avoids CDN cache hits)
  await supabase.storage
    .from('signatures')
    .remove([`${user.id}/signature.png`, `${user.id}/signature.jpg`, `${user.id}/signature.webp`]);

  const path = `${user.id}/signature_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('signatures')
    .upload(path, buffer, { contentType: mimeType });
  if (uploadErr) throw new Error(uploadErr.message);

  // Store the public URL format — encodes bucket+path for later signed URL generation
  const { data: { publicUrl } } = supabase.storage
    .from('signatures')
    .getPublicUrl(path);

  const { error } = await supabase
    .from('profiles')
    .update({ signature_url: publicUrl })
    .eq('id', user.id);
  if (error) throw new Error(error.message);

  // Return a signed URL for immediate display (bucket is private, public URL returns 403)
  const { data: signed } = await supabase.storage
    .from('signatures')
    .createSignedUrl(path, 3600);
  return signed?.signedUrl ?? publicUrl;
}

export async function deleteProfileSignature(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // List all files in the user's signatures folder and delete them
  const { data: files } = await supabase.storage
    .from('signatures')
    .list(user.id);

  if (files && files.length > 0) {
    const paths = files.map((f) => `${user.id}/${f.name}`);
    await supabase.storage.from('signatures').remove(paths);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ signature_url: null })
    .eq('id', user.id);
  if (error) throw new Error(error.message);
}
