import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProcessCompletePage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('legal_process_token');

  const supabase = await createClient();
  
    const { data: process, error } = await supabase
      .from('legal_processes')
      .select('id, access_token_used')
      .eq('id', id)
      .single();

    if(!process || error) {
      redirect('/404');
    }

  if (!token || process.access_token_used) {
    redirect('/link-expired');
  }

  const { error: updateError } = await supabase
    .from('legal_processes')
    .update({ access_token_used: true })
    .eq('id', id);


  return <div>Process Complete Page</div>;
}
