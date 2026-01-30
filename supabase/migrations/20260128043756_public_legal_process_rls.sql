-- Enable RLS
ALTER TABLE public.legal_processes ENABLE ROW LEVEL SECURITY;

-- READ: allow public (anon) to read pending client processes
CREATE POLICY "public_read_pending_process"
ON public.legal_processes
FOR SELECT
TO anon
USING (
  status = 'draft'
);

-- UPDATE: allow public (anon) to update pending client processes
CREATE POLICY "public_update_pending_process"
ON public.legal_processes
FOR UPDATE
TO anon
USING (
  status = 'draft'
)
WITH CHECK (
  status = 'draft'
);
