'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, MinusCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface WorkflowStep {
  id: string;
  name: string;
  status: StepStatus;
  started_at?: string | null;
  completed_at?: string | null;
}

interface WorkflowProgressProps {
  workflowRunId: string;
  /** Called when the run reaches a terminal status (completed, failed, cancelled). */
  onSettled?: (status: RunStatus) => void;
  /** Polling interval in ms. Default 2000. */
  pollIntervalMs?: number;
}

export function WorkflowProgress({
  workflowRunId,
  onSettled,
  pollIntervalMs = 2000,
}: WorkflowProgressProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus>('running');
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/workflow/status/${workflowRunId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json() as {
          status: RunStatus;
          steps: WorkflowStep[];
        };
        setSteps(data.steps ?? []);
        setRunStatus(data.status);

        if (['completed', 'failed', 'cancelled'].includes(data.status)) {
          onSettledRef.current?.(data.status);
          return; // stop polling
        }
      } catch {
        // silent — keep polling
      }

      if (!cancelled) {
        setTimeout(poll, pollIntervalMs);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [workflowRunId, pollIntervalMs]);

  const completedCount = steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(runStatus);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            {runStatus === 'running' && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
            )}
            {runStatus === 'completed' && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            )}
            {runStatus === 'failed' && (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            {runStatus === 'cancelled' && (
              <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {runStatus === 'running' && 'Ejecutando workflow...'}
            {runStatus === 'completed' && 'Workflow completado'}
            {runStatus === 'failed' && 'Workflow falló'}
            {runStatus === 'cancelled' && 'Workflow cancelado'}
            {runStatus === 'pending' && 'Iniciando...'}
          </span>
          {steps.length > 0 && (
            <span className="text-muted-foreground text-xs">
              {completedCount}/{steps.length} pasos
            </span>
          )}
        </div>
        <Progress
          value={isTerminal && runStatus === 'completed' ? 100 : progress}
          className={
            runStatus === 'failed'
              ? '[&>[data-slot=progress-indicator]]:bg-destructive'
              : runStatus === 'completed'
              ? '[&>[data-slot=progress-indicator]]:bg-green-600'
              : ''
          }
        />
      </div>

      {/* Step list */}
      {steps.length > 0 && (
        <div className="space-y-1">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2.5 rounded-md px-2 py-1 text-sm">
              {step.status === 'completed' && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              )}
              {step.status === 'running' && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
              )}
              {step.status === 'pending' && (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              {step.status === 'failed' && (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              )}
              {step.status === 'skipped' && (
                <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <span
                className={
                  step.status === 'completed' || step.status === 'skipped'
                    ? 'text-muted-foreground'
                    : step.status === 'running'
                    ? 'font-medium'
                    : step.status === 'failed'
                    ? 'text-destructive'
                    : 'text-muted-foreground/70'
                }
              >
                {step.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
