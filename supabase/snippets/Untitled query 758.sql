SELECT id
FROM legal_processes
WHERE access_token = '0e846e8d-432f-46c9-81c7-7b3e2d8aa492'
  AND access_token_used = false
  AND access_token_expires_at > NOW()
LIMIT 1;