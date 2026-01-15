import ProcessForm from '@/components/app/process/process-form';
import ProcessList from '@/components/app/process/process-list';
import { createClient } from '@/lib/supabase/server';

export default async function ProcessPage() {
  const supabase = await createClient();
  const { data: processes } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <ProcessForm />
      <ProcessList data={processes} />
    </div>
  );
}
