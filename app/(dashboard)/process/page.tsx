import ProcessForm from '@/components/app/process/process-form';
import ProcessFormSheet from '@/components/app/process/process-form-sheet';
import ProcessList from '@/components/app/process/process-list';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export default async function ProcessPage() {
  const supabase = await createClient();

  const { data: processes } = await supabase
    .from('legal_processes')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <ProcessFormSheet />
      </div>
      <ProcessList data={processes} />
    </div>
  );
}
