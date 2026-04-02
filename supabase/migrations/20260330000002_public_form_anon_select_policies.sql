-- Add anon SELECT policies for tables used by the public client form.
-- Without these, the form cannot load pre-filled data (document type, number, email)
-- or populate the document type and bank dropdowns.

-- legal_process_clients: load pre-filled client data
CREATE POLICY "anon_select_legal_process_clients"
  ON public.legal_process_clients FOR SELECT TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE access_token IS NOT NULL
    )
  );

-- legal_process_banks: load pre-filled banking data
CREATE POLICY "anon_select_legal_process_banks"
  ON public.legal_process_banks FOR SELECT TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE access_token IS NOT NULL
    )
  );

-- documents: populate document type dropdown
CREATE POLICY "anon_select_documents"
  ON public.documents FOR SELECT TO anon
  USING (
    organization_id IN (
      SELECT organization_id FROM public.legal_processes WHERE access_token IS NOT NULL
    )
  );

-- banks: populate bank dropdown
CREATE POLICY "anon_select_banks"
  ON public.banks FOR SELECT TO anon
  USING (
    organization_id IN (
      SELECT organization_id FROM public.legal_processes WHERE access_token IS NOT NULL
    )
  );
