'use server';

import { createClient } from '@/lib/supabase/server';
import { resumeWorkflow } from '@/lib/workflow/workflowRunner';
import { logClientAction } from '@/lib/audit/logClientAction';
import { decodeSectionFormValue } from '@/lib/forms/formDataCodec';
import { runDomainSync } from '@/lib/forms/domainSync/registry';
import type { FormSchema, FormSection } from '@/lib/forms/types';

const EMPTY_SCHEMA: FormSchema = { version: 1, sections: [] };

export async function getFormSchema(formSchemaId: string): Promise<FormSchema> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('legal_process_form_schemas')
    .select('schema')
    .eq('id', formSchemaId)
    .maybeSingle();

  return (data?.schema as FormSchema | undefined) ?? EMPTY_SCHEMA;
}

export async function getFormResponse(
  legalProcessId: string,
  sectionKey: string,
): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('legal_process_form_responses')
    .select('data')
    .eq('legal_process_id', legalProcessId)
    .eq('section_key', sectionKey)
    .maybeSingle();

  return (data?.data as Record<string, unknown> | undefined) ?? null;
}

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .toLowerCase();
}

type SubmitResult = { success: true; nextSectionKey: string } | { success: false; error: string };

export async function submitSectionAction(
  legalProcessId: string,
  formSchemaId: string,
  sectionKey: string,
  formData: FormData,
): Promise<SubmitResult> {
  const supabase = await createClient();

  const { data: legalProcess, error: processError } = await supabase
    .from('legal_processes')
    .select('id, organization_id, status, workflow_run_id')
    .eq('id', legalProcessId)
    .single();

  if (processError || !legalProcess || !legalProcess.organization_id) {
    return { success: false, error: 'Proceso legal no encontrado' };
  }
  if (legalProcess.status === 'completed') {
    return { success: false, error: 'Este proceso ya fue completado y no puede modificarse' };
  }

  const { data: schemaRow, error: schemaError } = await supabase
    .from('legal_process_form_schemas')
    .select('schema, domain_sync_key')
    .eq('id', formSchemaId)
    .single();

  if (schemaError || !schemaRow) {
    return { success: false, error: 'Formulario no encontrado' };
  }

  const schema = schemaRow.schema as unknown as FormSchema;
  const sections = [...schema.sections].sort((a, b) => a.order - b.order);
  const sectionIndex = sections.findIndex((s) => s.key === sectionKey);
  const section: FormSection | undefined = sections[sectionIndex];

  if (!section) {
    return { success: false, error: 'Sección de formulario no encontrada' };
  }

  const data: Record<string, unknown> = {};

  for (const field of section.fields) {
    const decoded = decodeSectionFormValue(field, formData);

    if (field.type === 'file_upload' || field.type === 'image_upload') {
      const { newFiles, existingPaths } = decoded as { newFiles: File[]; existingPaths: string[] };
      const uploadedPaths: string[] = [];

      for (const file of newFiles) {
        const path = `${legalProcess.organization_id}/${legalProcessId}/${sectionKey}-${field.key}-${Date.now()}-${sanitizeFileName(file.name)}`;
        const { data: uploaded, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(path, file, { upsert: true });

        if (uploadError) {
          return { success: false, error: `Error al subir archivo: ${file.name}` };
        }
        uploadedPaths.push(uploaded.path);
      }

      const allPaths = [...existingPaths, ...uploadedPaths];
      data[field.key] = field.type === 'file_upload' && (field.maxFiles ?? 1) > 1 ? allPaths : (allPaths[0] ?? null);
      continue;
    }

    data[field.key] = decoded;
  }

  const { error: upsertError } = await supabase
    .from('legal_process_form_responses')
    .upsert(
      {
        legal_process_id: legalProcessId,
        form_schema_id: formSchemaId,
        section_key: sectionKey,
        data: data as never,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'legal_process_id,section_key' },
    );

  if (upsertError) {
    return { success: false, error: 'Error al guardar las respuestas de esta sección' };
  }

  // Sincronización de dominio (opcional): sólo se ejecuta si el formulario
  // está explícitamente marcado con domain_sync_key (ej. 'financial_fraud').
  // El motor genérico no sabe qué hace el adapter ni conoce claves de
  // dominio — ver lib/forms/domainSync/.
  await runDomainSync(schemaRow.domain_sync_key, section, data, {
    supabase,
    legalProcessId,
    organizationId: legalProcess.organization_id,
  });

  await logClientAction({
    legalProcessId,
    action: 'client_form_section_submitted',
    metadata: { section_key: sectionKey },
  });

  const isLastSection = sectionIndex === sections.length - 1;

  if (!isLastSection) {
    return { success: true, nextSectionKey: sections[sectionIndex + 1].key };
  }

  // Última sección: marcar completado, reanudar el workflow y resolver
  // follow-ups pendientes — mismo patrón que updateInfoAboutEventsAction
  // (flujo legado) en actions.ts.
  const { error: updateProcessError } = await supabase
    .from('legal_processes')
    .update({ status: 'completed' })
    .eq('id', legalProcessId);

  if (updateProcessError) {
    return { success: false, error: 'Error al finalizar el proceso' };
  }

  if (legalProcess.workflow_run_id) {
    await resumeWorkflow(legalProcess.workflow_run_id, { form_completed_at: new Date().toISOString() });
  }

  try {
    const adminSupabase = await createClient({ admin: true });
    await adminSupabase
      .from('email_follow_ups')
      .update({ status: 'received', resolved_at: new Date().toISOString() })
      .eq('legal_process_id', legalProcessId)
      .eq('resolution_mode', 'form')
      .eq('status', 'pending');
  } catch (err) {
    console.error('[submitSectionAction] Failed to resolve form follow-ups', err);
  }

  await logClientAction({
    legalProcessId,
    action: 'client_process_completed',
  });

  return { success: true, nextSectionKey: 'success' };
}
