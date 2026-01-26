import { Badge } from '@/components/ui/badge';
import { Database } from '@/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

interface ProcessListProps {
  data: Client[] | null;
}

export default function ProcessList({ data }: ProcessListProps) {
  if (!data || data.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="text-muted-foreground">No active processes found.</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a new process using the form above.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Process List</h2>
      <div className="grid gap-4 md:grid-cols-1">
        {data.map((process, index) => (
          <ProcessCard key={process.id} process={process} index={index} />
        ))}
      </div>
    </div>
  );
}

function ProcessCard({ process, index }: { process: Client; index: number }) {
  // Simple animation delay based on index
  return (
    <div
      className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards hover:shadow-md"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="p-5">
        <div className="flex items-center space-x-4">
          <Badge
            variant={process.status === 'draft' ? 'secondary' : 'default'}
            className="capitalize"
          >
            {process.status}
          </Badge>
          <div>
            <h3
              className="truncate font-semibold leading-none tracking-tight"
              title={process.email || ''}
            >
              {process.email || 'No Email'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Created{' '}
              {process.created_at
                ? new Date(process.created_at).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
