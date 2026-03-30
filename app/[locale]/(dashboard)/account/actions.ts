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
      .select('id, firstname, lastname, email, phone, document_type, document_number, professional_card_number, signature_url')
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

  return { profile, memberships: memberships ?? [], catalogDocuments: catalogDocuments ?? [] };
}

export async function updateAccountProfile(values: {
  firstname: string;
  lastname: string;
  phone: string;
  document_type: string;
  document_number: string;
  professional_card_number?: string;
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
    })
    .eq('id', user.id);

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
  const path = `${user.id}/signature.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('signatures')
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data: { publicUrl } } = supabase.storage
    .from('signatures')
    .getPublicUrl(path);

  const { error } = await supabase
    .from('profiles')
    .update({ signature_url: publicUrl })
    .eq('id', user.id);
  if (error) throw new Error(error.message);

  return publicUrl;
}

export async function deleteProfileSignature(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Remove any known extension variants
  await supabase.storage
    .from('signatures')
    .remove([`${user.id}/signature.png`, `${user.id}/signature.jpg`, `${user.id}/signature.webp`]);

  const { error } = await supabase
    .from('profiles')
    .update({ signature_url: null })
    .eq('id', user.id);
  if (error) throw new Error(error.message);
}
