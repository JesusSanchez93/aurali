import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { LegalProcessClientSideProvider } from './_context/LegalProcessClientSideProvider';
import { ProcessCompleteMain } from './_components/ProcessCompleteMain';
import { getLegalProcessBankingInformation, getLegalProcessClientData, getLegalProcessDocumentTypes, getLegalProcessBanks } from './[step]/actions';
import { FormUnavailable } from './_components/FormUnavailable';

interface Props {
  params: Promise<{ id: string }>;
  children: ReactNode;
}

export default async function ProcessCompleteLayout({
  params,
  children,
}: Props) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: process, error } = await supabase
    .from('legal_processes')
    .select('id, access_token, status')
    .eq('id', id)
    .single();

  if (!process || error) redirect('/404');

  // Verify the session cookie matches this process's token
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('legal_process_token')?.value;

  if (!sessionToken || sessionToken !== process.access_token) {
    return <FormUnavailable reason="no_access" />;
  }

  // Form is only available while the process is awaiting client data
  if (process.status === 'completed') {
    return <FormUnavailable reason="completed" />;
  }

  if (!['draft', 'form_sent'].includes(process.status)) {
    return <FormUnavailable reason="unavailable" />;
  }

  const [clientData, bankingData, documentTypes, banks] = await Promise.all([
    getLegalProcessClientData(id),
    getLegalProcessBankingInformation(id),
    getLegalProcessDocumentTypes(id),
    getLegalProcessBanks(id),
  ]);

  return (
    <div>
      <LegalProcessClientSideProvider
        id={id}
        clientData={clientData}
        bankingData={bankingData}
        documentTypes={documentTypes}
        banks={banks}
      >
        <ProcessCompleteMain>{children}</ProcessCompleteMain>
      </LegalProcessClientSideProvider>
    </div>
  );
}
