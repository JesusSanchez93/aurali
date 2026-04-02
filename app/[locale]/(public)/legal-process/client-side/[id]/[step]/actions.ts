'use server';

import { createClient } from '@/lib/supabase/server';
import { Tables } from '@/types/database.types';
import { revalidatePath } from 'next/cache';
import { resumeWorkflow } from '@/lib/workflow/workflowRunner';
import { validateDocumentImages } from '@/lib/anthropic/validateDocument';

type PersonalDataActionResult =
    | { success: true }
    | {
          success: false;
          validationError: {
              errors: string[];
              extractedData?: { fullName?: string | null; documentNumber?: string | null };
          };
      };

export async function updatePersonalDataAction(
    legalProcessId: string,
    formData: FormData
): Promise<PersonalDataActionResult> {
    const supabase = await createClient();

    // Extract form data
    const firstname = formData.get('firstname') as string;
    const lastname = formData.get('lastname') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const document_id = formData.get('document_id') as string;
    const document_number = formData.get('document_number') as string;
    const document_front_image = formData.get('document_front_image') as File;
    const document_back_image = formData.get('document_back_image') as File;

    // Find the legal process to ensure it exists and is still open
    const { data: legalProcess, error: processError } = await supabase
        .from('legal_processes')
        .select('id, organization_id, status')
        .eq('id', legalProcessId)
        .single();

    if (processError || !legalProcess) {
        throw new Error('Proceso legal no encontrado');
    }

    if (legalProcess.status === 'completed') {
        throw new Error('Este proceso ya fue completado y no puede modificarse');
    }

    // Update legal_process_clients
    const { data: existingClient, error: clientFetchError } = await supabase
        .from('legal_process_clients')
        .select('*')
        .eq('legal_process_id', legalProcessId)
        .single();

    if (clientFetchError && clientFetchError.code !== 'PGRST116') {
        console.error('Error fetching client:', clientFetchError);
        throw new Error('Error al buscar cliente asociado');
    }

    // Storage helpers
    const uploadFile = async (file: File, path: string) => {
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(path, file, { upsert: true });

        if (error) {
            console.error('Error uploading file:', error);
            throw new Error(`Error al subir archivo: ${file.name}`);
        }

        return data.path;
    };

    const deleteFile = async (path: string) => {
        const { error } = await supabase.storage
            .from('documents')
            .remove([path]);

        if (error) {
            console.error('Error deleting file from storage:', error);
        }
    };

    const oldFrontPath = existingClient?.document_front_image ?? null;
    const oldBackPath = existingClient?.document_back_image ?? null;

    let frontPath: string | null = oldFrontPath;
    let backPath: string | null = oldBackPath;
    let newFrontPath: string | null = null;
    let newBackPath: string | null = null;

    const frontKeep = formData.get('document_front_image_keep') === 'true';
    const backKeep = formData.get('document_back_image_keep') === 'true';

    // Upload new files first — old files are deleted only after DB succeeds
    if (document_front_image instanceof File && document_front_image.size > 0) {
        newFrontPath = await uploadFile(
            document_front_image,
            `${legalProcess.organization_id}/${legalProcessId}/front-${Date.now()}-${sanitizeFileName(document_front_image.name)}`
        );
        frontPath = newFrontPath;
    } else if (!frontKeep) {
        frontPath = null;
    }

    if (document_back_image instanceof File && document_back_image.size > 0) {
        newBackPath = await uploadFile(
            document_back_image,
            `${legalProcess.organization_id}/${legalProcessId}/back-${Date.now()}-${sanitizeFileName(document_back_image.name)}`
        );
        backPath = newBackPath;
    } else if (!backKeep) {
        backPath = null;
    }

    const clientData = {
        first_name: firstname,
        last_name: lastname,
        document_id: document_id,
        document_number: document_number,
        document_front_image: frontPath,
        document_back_image: backPath,
        email: email,
        phone: phone,
    };

    if (existingClient) {
        const { error: updateError } = await supabase
            .from('legal_process_clients')
            .update(clientData)
            .eq('id', existingClient.id);

        if (updateError) {
            // DB failed — rollback newly uploaded files to avoid orphans
            if (newFrontPath) await deleteFile(newFrontPath);
            if (newBackPath) await deleteFile(newBackPath);
            console.error('Error updating existing client:', updateError);
            throw new Error('Error al actualizar datos del cliente en el proceso');
        }

        // DB succeeded — now safe to delete replaced/removed old files
        if (newFrontPath && oldFrontPath) await deleteFile(oldFrontPath);
        if (newBackPath && oldBackPath) await deleteFile(oldBackPath);
        if (!frontKeep && !newFrontPath && oldFrontPath) await deleteFile(oldFrontPath);
        if (!backKeep && !newBackPath && oldBackPath) await deleteFile(oldBackPath);

        // Update source-of-truth clients table (best-effort, non-blocking)
        if (existingClient.client_id) {
            const { error: clientUpdateError } = await supabase
                .from('clients')
                .update({
                    first_name: firstname,
                    last_name: lastname,
                    email: email,
                    phone: phone,
                    document_id: document_id,
                    document_number: document_number,
                    document_front_image: frontPath,
                    document_back_image: backPath,
                })
                .eq('id', existingClient.client_id);

            if (clientUpdateError) {
                console.error('Error updating main client record:', clientUpdateError);
            }
        }
    } else {
        throw new Error('No se encontró el registro de cliente para este proceso');
    }

    // Document validation with Claude (only when both images exist)
    if (frontPath && backPath) {
        const { data: frontSigned } = await supabase.storage
            .from('documents')
            .createSignedUrl(frontPath, 60);
        const { data: backSigned } = await supabase.storage
            .from('documents')
            .createSignedUrl(backPath, 60);

        if (frontSigned?.signedUrl && backSigned?.signedUrl) {
            console.log('[updatePersonalDataAction] Calling validateDocumentImages with paths:', { frontPath, backPath });
            const validation = await validateDocumentImages({
                firstName: firstname,
                lastName: lastname,
                documentNumber: document_number,
                frontImageUrl: frontSigned.signedUrl,
                backImageUrl: backSigned.signedUrl,
            });
            console.log('[updatePersonalDataAction] Validation result:', validation);

            // Persist result for lawyer audit (always, even on error)
            await supabase
                .from('legal_process_clients')
                .update({
                    doc_validation_status: validation.status,
                    doc_validation_details: {
                        errors: validation.errors,
                        extractedData: validation.extractedData,
                    },
                    doc_validated_at: new Date().toISOString(),
                })
                .eq('id', existingClient.id);

            // Block only on invalid — error degrades gracefully (user advances)
            if (validation.status === 'invalid') {
                return {
                    success: false,
                    validationError: {
                        errors: validation.errors,
                        extractedData: validation.extractedData,
                    },
                };
            }
        }
    }

    return { success: true };
}


export async function getLegalProcessClientData(legalProcessId: string): Promise<Tables<'legal_process_clients'> | null> {
    const supabase = await createClient();

    const { data } = await supabase
        .from('legal_process_clients')
        .select('*')
        .eq('legal_process_id', legalProcessId)
        .single();

    let client;

    if (data?.id) {
        client = { ...data }
    }

    if (client) {
        if (client.document_front_image && !client.document_front_image.startsWith('http')) {
            const { data: frontData } = await supabase.storage
                .from('documents')
                .createSignedUrl(client.document_front_image, 3600);

            if (frontData) client.document_front_image = frontData.signedUrl;
        }
        if (client.document_back_image && !client.document_back_image.startsWith('http')) {
            const { data: backData } = await supabase.storage
                .from('documents')
                .createSignedUrl(client.document_back_image, 3600);
            if (backData) client.document_back_image = backData.signedUrl;
        }
    }


    return client ?? null;
}

export async function getLegalProcessBankingInformation(legalProcessId: string): Promise<Tables<'legal_process_banks'> | null> {
    const supabase = await createClient();

    const { data: bank } = await supabase
        .from('legal_process_banks')
        .select('*')
        .eq('legal_process_id', legalProcessId)
        .single();

    return bank;
}

export async function getLegalProcessDocumentTypes(legalProcessId: string) {
    const supabase = await createClient();

    const { data: process } = await supabase
        .from('legal_processes')
        .select('organization_id')
        .eq('id', legalProcessId)
        .single();

    if (!process?.organization_id) return [];

    const { data: documents } = await supabase
        .from('documents')
        .select('id, name, slug')
        .eq('organization_id', process.organization_id);

    return (documents || []).map((doc) => ({
        id: doc.id,
        slug: doc.slug,
        name: (doc.name as { es?: string; en?: string } | null)?.es ?? doc.slug ?? doc.id,
    }));
}

export async function getLegalProcessBanks(legalProcessId: string) {
    const supabase = await createClient();

    const { data: process } = await supabase
        .from('legal_processes')
        .select('organization_id')
        .eq('id', legalProcessId)
        .single();

    if (!process?.organization_id) return [];

    const { data: banks, error } = await supabase
        .from('banks')
        .select('id, name, slug')
        .eq('organization_id', process.organization_id);

    return (banks || []).map((bank) => ({
        id: bank.id,
        name: bank.name || 'Banco',
        slug: bank.slug || '',
    }));
}

export async function deleteImageAction(
    legalProcessId: string,
    field: 'document_front_image' | 'document_back_image'
) {
    const supabase = await createClient();

    // Get current path to delete from storage
    const { data: client, error: fetchError } = await supabase
        .from('legal_process_clients')
        .select(`id, client_id, ${field}`)
        .eq('legal_process_id', legalProcessId)
        .single();

    if (fetchError || !client) {
        throw new Error('No se pudo encontrar el cliente para eliminar la imagen');
    }

    const clientAny = client as any;
    const path = clientAny[field] as string;

    if (path && !path.startsWith('http')) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([path]);

        if (storageError) {
            console.error('Error deleting from storage:', storageError);
        }
    }

    // Update legal_process_clients
    const { error: updateError } = await supabase
        .from('legal_process_clients')
        .update({ [field]: null })
        .eq('id', client.id);

    if (updateError) {
        throw new Error('Error al limpiar la referencia de la imagen en el proceso');
    }

    // Update main clients table if client_id exists
    if (client.client_id) {
        await supabase
            .from('clients')
            .update({ [field]: null })
            .eq('id', client.client_id);
    }

    revalidatePath('/(public)/legal-process', 'layout');

    return { success: true };
}

function sanitizeFileName(name: string) {
    return name
        .normalize("NFD") // quita acentos
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-") // espacios -> -
        .replace(/[^a-zA-Z0-9.-]/g, "") // solo caracteres seguros
        .toLowerCase();
}

export async function updateBankingInformationAction(
    legalProcessId: string,
    formData: FormData
) {
    const supabase = await createClient();

    // Extract basic fields
    const bank_id = formData.get('bank_id') as string;
    const bank_name = formData.get('bank_name') as string | null;
    const bank_slug = formData.get('bank_slug') as string | null;
    const last_4_digits = formData.get('last_4_digits') as string;

    // Handle files
    const uploadFile = async (file: File, path: string) => {
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(path, file, { upsert: true });

        if (error) {
            console.error('Error uploading file:', error);
            throw new Error(`Error al subir archivo: ${file.name}`);
        }
        return data.path;
    };

    const { data: legalProcess, error: processError } = await supabase
        .from('legal_processes')
        .select('id, organization_id, status')
        .eq('id', legalProcessId)
        .single();

    if (processError || !legalProcess) {
        throw new Error('Proceso legal no encontrado');
    }

    if (legalProcess.status === 'completed') {
        throw new Error('Este proceso ya fue completado y no puede modificarse');
    }

    const { data: existingBank, error: bankFetchError } = await supabase
        .from('legal_process_banks')
        .select('*')
        .eq('legal_process_id', legalProcessId)
        .single();

    let bankRequestPath = existingBank?.bank_request;
    const bankRequestFile = formData.get('bank_request') as File | null;

    if (bankRequestFile && bankRequestFile.size > 0) {
        bankRequestPath = await uploadFile(
            bankRequestFile,
            `${legalProcess.organization_id}/${legalProcessId}/bank-request-${Date.now()}-${sanitizeFileName(bankRequestFile.name)}`
        );
    }

    // Handle multiple files
    const uploadMultipleFiles = async (files: File[], prefix: string) => {
        const paths = [];
        for (const file of files) {
            if (file && file.size > 0) {
                const path = await uploadFile(
                    file,
                    `${legalProcess.organization_id}/${legalProcessId}/${prefix}-${Date.now()}-${sanitizeFileName(file.name)}`
                );
                paths.push(path);
            }
        }
        return paths.length > 0 ? JSON.stringify(paths) : null;
    };

    const bankResponseFiles = formData.getAll('bank_response') as File[];
    let bankResponsePath = existingBank?.bank_response;
    if (bankResponseFiles.length > 0 && bankResponseFiles[0].size > 0) {
        bankResponsePath = await uploadMultipleFiles(bankResponseFiles, 'bank-response');
    }

    const statementFiles = formData.getAll('latest_account_statement') as File[];
    let statementPath = existingBank?.latest_account_statement;
    if (statementFiles.length > 0 && statementFiles[0].size > 0) {
        statementPath = await uploadMultipleFiles(statementFiles, 'account-statement');
    }

    const updateData = {
        bank_id,
        bank_name,
        bank_slug,
        last_4_digits,
        bank_request: bankRequestPath,
        bank_response: bankResponsePath,
        latest_account_statement: statementPath,
        legal_process_id: legalProcessId,
        organization_id: legalProcess.organization_id!,
    };

    if (existingBank) {
        const { error: updateError } = await supabase
            .from('legal_process_banks')
            .update(updateData)
            .eq('id', existingBank.id);
        // 
        if (updateError) {
            console.error({ updateError });
            throw new Error('Error al actualizar información bancaria');
        }
    } else {
        const { error: insertError } = await supabase
            .from('legal_process_banks')
            .insert(updateData);

        if (insertError) {
            console.error({ insertError });
            throw new Error('Error al guardar información bancaria');
        }
    }

    revalidatePath('/(public)/legal-process', 'layout');
    return { success: true };
}

export async function updateInfoAboutEventsAction(
    legalProcessId: string,
    formData: FormData
) {
    const supabase = await createClient();

    const { data: legalProcess, error: processError } = await supabase
        .from('legal_processes')
        .select('id, status')
        .eq('id', legalProcessId)
        .single();

    if (processError || !legalProcess) {
        throw new Error('Proceso legal no encontrado');
    }

    if (legalProcess.status === 'completed') {
        throw new Error('Este proceso ya fue completado y no puede modificarse');
    }

    const file_complait = formData.get('file_complait') === 'true';
    const no_signal = formData.get('no_signal') === 'true';
    const bank_notification = formData.get('bank_notification') === 'true';
    const access_website = formData.get('access_website') === 'true';
    const access_link = formData.get('access_link') === 'true'; // Map from access_link
    const used_to_operate_stolen_amount = formData.get('used_to_operate_stolen_amount') === 'true';
    const lost_card = formData.get('lost_card') === 'true';
    const fraud_incident_summary = formData.get('fraud_incident_summary') as string;

    const { data: existingBank, error: bankFetchError } = await supabase
        .from('legal_process_banks')
        .select('id')
        .eq('legal_process_id', legalProcessId)
        .single();

    const updateData = {
        file_complait,
        no_signal,
        bank_notification,
        access_website,
        access_link,
        used_to_operate_stolen_amount,
        lost_card,
        fraud_incident_summary,
        legal_process_id: legalProcessId,
    };

    if (existingBank) {
        const { error: updateError } = await supabase
            .from('legal_process_banks')
            .update(updateData)
            .eq('id', existingBank.id);
        if (updateError) {
            console.error({ updateError });
            throw new Error('Error al actualizar incidentes');
        }

            const { error: updateProcessError } = await supabase
            .from('legal_processes')
            .update({ status: 'completed' })
            .eq('id', legalProcessId);

        if (updateProcessError) {
            console.error({ updateProcessError });
            throw new Error('Error al actualizar el proceso');
        }
    } else {
        const { error: insertError } = await supabase
            .from('legal_process_banks')
            .insert(updateData);
        if (insertError) {
            console.error({ insertError });
            throw new Error('Error al guardar incidentes');
        }

        const { error: updateProcessError } = await supabase
            .from('legal_processes')
            .update({ status: 'completed' })
            .eq('id', legalProcessId);

        if (updateProcessError) {
            console.error({ updateProcessError });
            throw new Error('Error al actualizar el proceso');
        }
    }

    // Resume the workflow from the client_form blocking node.
    // Continues: status_update(completed) → notify_lawyer → manual_action (BLOCKING)
    const { data: process } = await supabase
        .from('legal_processes')
        .select('workflow_run_id')
        .eq('id', legalProcessId)
        .single();

    if (process?.workflow_run_id) {
        await resumeWorkflow(process.workflow_run_id, { form_completed_at: new Date().toISOString() });
    }

    revalidatePath('/(public)/legal-process', 'layout');
    return { success: true };
}


