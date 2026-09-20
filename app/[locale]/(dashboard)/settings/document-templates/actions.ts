'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { getOrgAndUser } from '@/lib/server/get-org-user';
import { assertValidUploadFile } from '@/lib/server/validate-upload';

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_DOCX_BYTES = 15 * 1024 * 1024;

export async function getTemplates() {
    const { supabase, organizationId } = await getOrgAndUser();

    const { data, error } = await supabase
        .from('legal_templates')
        .select('id, name, version, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function getTemplate(id: string) {
    const { supabase, organizationId } = await getOrgAndUser();

    const { data, error } = await supabase
        .from('legal_templates')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single();

    if (error) throw new Error(error.message);
    return data;
}


/**
 * Creates a new template row and uploads its source .docx in one step —
 * ONLYOFFICE editing requires a real file to already exist in Storage before
 * the embedded editor can open it.
 */
export async function createTemplateWithDocx(name: string, file: File): Promise<{ id: string }> {
    const { supabase, organizationId } = await getOrgAndUser();

    if (!name?.trim()) throw new Error('El nombre de la plantilla es requerido');
    assertValidUploadFile(file, { extensions: ['.docx'], maxBytes: MAX_DOCX_BYTES });

    const { data: created, error: insertErr } = await supabase
        .from('legal_templates')
        .insert({ name, organization_id: organizationId, docx_document_key: randomUUID() })
        .select('id')
        .single();

    if (insertErr || !created) throw new Error(insertErr?.message ?? 'No se pudo crear la plantilla');

    const storagePath = `${organizationId}/templates/${created.id}.docx`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, buffer, { contentType: DOCX_CONTENT_TYPE, upsert: true });

    if (uploadErr) throw new Error(uploadErr.message);

    const { error: updateErr } = await supabase
        .from('legal_templates')
        .update({ docx_storage_path: storagePath })
        .eq('id', created.id);

    if (updateErr) throw new Error(updateErr.message);

    revalidatePath('/', 'layout');
    return { id: created.id };
}

/** Uploads/replaces a template's source .docx outside the embedded editor (e.g. first upload for an existing row). */
export async function uploadTemplateDocx(templateId: string, file: File): Promise<void> {
    const { supabase, organizationId } = await getOrgAndUser();

    if (!templateId?.trim()) throw new Error('templateId es requerido');
    assertValidUploadFile(file, { extensions: ['.docx'], maxBytes: MAX_DOCX_BYTES });

    const storagePath = `${organizationId}/templates/${templateId}.docx`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, buffer, { contentType: DOCX_CONTENT_TYPE, upsert: true });

    if (uploadErr) throw new Error(uploadErr.message);

    const { error: updateErr } = await supabase
        .from('legal_templates')
        .update({ docx_storage_path: storagePath, docx_document_key: randomUUID() })
        .eq('id', templateId)
        .eq('organization_id', organizationId);

    if (updateErr) throw new Error(updateErr.message);
    revalidatePath('/', 'layout');
}

export async function renameTemplate(id: string, name: string): Promise<void> {
    const { supabase, organizationId } = await getOrgAndUser();

    if (!id?.trim()) throw new Error('id es requerido');
    if (!name?.trim()) throw new Error('El nombre de la plantilla es requerido');

    const { error } = await supabase
        .from('legal_templates')
        .update({ name })
        .eq('id', id)
        .eq('organization_id', organizationId);

    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
}

export async function deleteTemplate(id: string) {
    const { supabase, organizationId } = await getOrgAndUser();

    if (!id?.trim()) throw new Error('id es requerido');

    const { error } = await supabase
        .from('legal_templates')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
}
