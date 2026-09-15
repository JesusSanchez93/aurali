import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFormSchema } from "./[step]/dynamic-actions";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProcessCompletePage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: process } = await supabase
    .from('legal_processes')
    .select('form_schema_id')
    .eq('id', id)
    .single();

  if (!process?.form_schema_id) {
    redirect(`/legal-process/client-side/${id}/personal-data`);
  }

  const schema = await getFormSchema(process.form_schema_id);
  const firstSection = [...schema.sections].sort((a, b) => a.order - b.order)[0];
  redirect(`/legal-process/client-side/${id}/${firstSection?.key ?? 'success'}`);
}
