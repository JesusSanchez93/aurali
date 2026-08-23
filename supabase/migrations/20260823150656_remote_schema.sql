drop index if exists "public"."idx_audit_logs_created_at";

drop index if exists "public"."idx_audit_logs_entity";

drop index if exists "public"."idx_audit_logs_org_created_at";

drop index if exists "public"."idx_audit_logs_org_id";

drop policy "auth_delete_documents" on "storage"."objects";

drop policy "auth_select_documents" on "storage"."objects";

drop policy "auth_upload_documents" on "storage"."objects";


  create policy "auth_delete_documents"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] IN ( SELECT (organization_members.organization_id)::text AS organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.active = true))))));



  create policy "auth_select_documents"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] IN ( SELECT (organization_members.organization_id)::text AS organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.active = true))))));



  create policy "auth_upload_documents"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] IN ( SELECT (organization_members.organization_id)::text AS organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.active = true))))));



