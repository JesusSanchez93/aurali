drop policy "public_read_pending_process" on "public"."legal_processes";

drop policy "public_update_pending_process" on "public"."legal_processes";


  create policy "public_read_pending_process"
  on "public"."legal_processes"
  as permissive
  for select
  to anon
using ((status = 'pending_client_data'::text));



  create policy "public_update_pending_process"
  on "public"."legal_processes"
  as permissive
  for update
  to anon
using ((status = 'pending_client_data'::text))
with check ((status = 'pending_client_data'::text));



