'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { PlayCircle, RotateCcw, FileCheck } from 'lucide-react';
import {
  getPendingManualAction,
  retryFailedWorkflow,
  approveDocumentPreviews,
  type PendingWorkflowAction,
} from '@/app/[locale]/(dashboard)/legal-process/actions';

interface Props {
  legalProcessId: string;
  refreshKey?: number;
  onSuccess: () => void;
}

export function WorkflowActionButton({ legalProcessId, refreshKey, onSuccess }: Props) {
  const [loading, setLoading]       = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting]   = useState(false);
  const [action, setAction]         = useState<PendingWorkflowAction | null>(null);

  const fetchAction = useCallback(() => {
    setLoading(true);
    getPendingManualAction(legalProcessId)
      .then(setAction)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [legalProcessId]);

  useEffect(() => {
    fetchAction();
  }, [fetchAction, refreshKey]);

  // ── Acción manual: resume via /api/workflow/resume ───────────────────────
  const handleManualConfirm = async () => {
    if (!action || action.kind !== 'manual_action') return;
    setExecuting(true);
    try {
      const res = await fetch('/api/workflow/resume', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ workflowRunId: action.workflowRunId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al ejecutar la acción');
      }
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
      setConfirming(false);
    }
  };

  // ── Document preview: approve → generate final PDFs and resume workflow ──
  const handleApproveDocuments = async () => {
    setExecuting(true);
    try {
      await approveDocumentPreviews(legalProcessId);
      onSuccess();
    } catch (err) {
      console.error('[WorkflowActionButton] approveDocumentPreviews:', err);
    } finally {
      setExecuting(false);
      setConfirming(false);
    }
  };

  // ── Failed run: retry via server action ──────────────────────────────────
  const handleRetry = async () => {
    setExecuting(true);
    try {
      await retryFailedWorkflow(legalProcessId);
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
      setConfirming(false);
    }
  };

  if (loading) {
    return <Spinner className="h-4 w-4 text-muted-foreground" />;
  }

  if (!action) return null;

  // ── Document preview state ────────────────────────────────────────────────
  if (action.kind === 'document_preview') {
    return (
      <>
        <Button
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={executing}
        >
          {executing ? (
            <Spinner className="mr-2 h-4 w-4" />
          ) : (
            <FileCheck className="mr-2 h-4 w-4" />
          )}
          Aprobar documentos
        </Button>

        <ConfirmDialog
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={handleApproveDocuments}
          title="Aprobar documentos"
          description={`Se ${action.previewCount === 1 ? 'ha generado 1 vista previa' : `han generado ${action.previewCount} vistas previas`} de los documentos. Al aprobar, se generarán los PDFs finales y serán enviados al cliente. Esta acción no se puede deshacer.`}
          confirmLabel="Aprobar y generar PDFs"
          cancelLabel="Cancelar"
        />
      </>
    );
  }

  // ── Failed state ─────────────────────────────────────────────────────────
  if (action.kind === 'failed') {
    return (
      <>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setConfirming(true)}
          disabled={executing}
        >
          {executing ? (
            <Spinner className="mr-2 h-4 w-4" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          Reintentar flujo
        </Button>

        <ConfirmDialog
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={handleRetry}
          title={`Flujo detenido en: ${action.nodeTitle}`}
          description={
            action.error
              ? `Error: ${action.error}\n\n¿Deseas reintentar desde este paso?`
              : `El flujo se detuvo en "${action.nodeTitle}". ¿Deseas reintentar?`
          }
          confirmLabel="Reintentar"
          cancelLabel="Cancelar"
        />
      </>
    );
  }

  // ── Manual action ─────────────────────────────────────────────────────────
  return (
    <>
      <Button
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={executing}
      >
        {executing ? (
          <Spinner className="mr-2 h-4 w-4" />
        ) : (
          <PlayCircle className="mr-2 h-4 w-4" />
        )}
        {action.nodeTitle}
      </Button>

      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleManualConfirm}
        title={action.nodeTitle}
        description={
          action.instructions
            ? `${action.instructions}\n\nEsta acción no se puede deshacer.`
            : 'Esta acción avanzará el flujo al siguiente paso. Esta acción no se puede deshacer.'
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
      />
    </>
  );
}
