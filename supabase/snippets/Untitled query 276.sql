SELECT 
  lp.*,
  lpc.*
FROM legal_processes lp
INNER JOIN legal_process_clients lpc
  ON lpc.legal_process_id = lp.id
WHERE lp.organization_id = 'dcdd1cb4-520a-4176-afc4-06b056d02277';