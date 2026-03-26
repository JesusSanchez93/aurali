'use client';

import { Tables } from '@/types/database.types';
import { createContext, ReactNode, useContext } from 'react';

type DocumentType = { id: string; slug: string | null; name: string };
type BankType = { id: string; name: string; slug: string };

interface LegalProcessClientSideContextType {
  id: string;
  clientData: Tables<'legal_process_clients'> | null;
  bankingData: Tables<'legal_process_banks'> | null;
  documentTypes: DocumentType[];
  banks: BankType[];
}

const LegalProcessClientSideContext =
  createContext<LegalProcessClientSideContextType | null>(null);

interface ProviderProps {
  id: string;
  clientData: Tables<'legal_process_clients'> | null;
  bankingData: Tables<'legal_process_banks'> | null;
  documentTypes: DocumentType[];
  banks: BankType[];
  children: ReactNode;
}

export function LegalProcessClientSideProvider({
  id,
  clientData,
  bankingData,
  documentTypes,
  banks,
  children,
}: ProviderProps) {
  return (
    <LegalProcessClientSideContext.Provider value={{ id, clientData, bankingData, documentTypes, banks }}>
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
