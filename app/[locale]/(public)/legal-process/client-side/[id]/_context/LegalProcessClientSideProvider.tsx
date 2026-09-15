'use client';

import { Tables } from '@/types/database.types';
import { createContext, ReactNode, useContext } from 'react';
import type { FormSchema } from '@/lib/forms/types';

type DocumentType = { id: string; slug: string | null; name: string };
type BankType = { id: string; name: string; slug: string };

interface LegalProcessClientSideContextType {
  id: string;
  clientData: Tables<'legal_process_clients'> | null;
  bankingData: Tables<'legal_process_banks'> | null;
  documentTypes: DocumentType[];
  banks: BankType[];
  /** null cuando el proceso usa el flujo legado (fraude bancario, pasos fijos) */
  formSchema: FormSchema | null;
}

const LegalProcessClientSideContext =
  createContext<LegalProcessClientSideContextType | null>(null);

interface ProviderProps {
  id: string;
  clientData: Tables<'legal_process_clients'> | null;
  bankingData: Tables<'legal_process_banks'> | null;
  documentTypes: DocumentType[];
  banks: BankType[];
  formSchema: FormSchema | null;
  children: ReactNode;
}

export function LegalProcessClientSideProvider({
  id,
  clientData,
  bankingData,
  documentTypes,
  banks,
  formSchema,
  children,
}: ProviderProps) {
  return (
    <LegalProcessClientSideContext.Provider value={{ id, clientData, bankingData, documentTypes, banks, formSchema }}>
      {children}
    </LegalProcessClientSideContext.Provider>
  );
}

function useLegalProcessClientSide() {
  const ctx = useContext(LegalProcessClientSideContext);

  if (!ctx) {
    throw new Error(
      'useLegalProcessClientSide must be used inside LegalProcessClientSideProvider',
    );
  }

  return ctx;
}

export function useLegalProcessClientData() {
  return useLegalProcessClientSide().clientData;
}

export function useLegalProcessBankingData() {
  return useLegalProcessClientSide().bankingData;
}

export function useLegalProcessId() {
  return useLegalProcessClientSide().id;
}

export function useLegalProcessDocumentTypes() {
  return useLegalProcessClientSide().documentTypes;
}

export function useLegalProcessBanks() {
  return useLegalProcessClientSide().banks;
}

export function useLegalProcessFormSchema() {
  return useLegalProcessClientSide().formSchema;
}
