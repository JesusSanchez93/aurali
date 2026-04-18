'use client';

import { useReducer, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PlayCircle, RotateCcw, FileCheck, FilePlus, Paperclip } from 'lucide-react';
import {
  getPendingManualAction,
  retryFailedWorkflow,
  approveDocumentPreviews,
  confirmDocumentTemplates,
  confirmEmailAttachments,
  type PendingWorkflowAction,
} from '@/app/[locale]/(dashboard)/legal-process/actions';
import { getGoogleDocTemplates } from '@/app/[locale]/(dashboard)/settings/google-templates/actions';

interface Props {
  legalProcessId: string;
  refreshKey?: number;
  onSuccess: () => void;
}

// ── Reducer ───────────────────────────────────────────────────────────────────
type State = {
  loading: boolean;
  confirming: boolean;
  executing: boolean;
  action: PendingWorkflowAction | null;
  templates: { id: string; name: string }[];
  selectedTemplateIds: string[];
  selectedDocumentIds: string[];
};

type ReducerAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_DONE'; action: PendingWorkflowAction | null }
  | { type: 'SET_CONFIRMING'; value: boolean }
  | { type: 'EXEC_START' }
  | { type: 'EXEC_DONE' }
  | { type: 'SET_TEMPLATES'; templates: { id: string; name: string }[] }
  | { type: 'TOGGLE_TEMPLATE'; id: string }
  | { type: 'TOGGLE_DOCUMENT'; id: string };

const initialState: State = {
  loading: true,
  confirming: false,
  executing: false,
  action: null,
  templates: [],
  selectedTemplateIds: [],
  selectedDocumentIds: [],
};

function reducer(state: State, action: ReducerAction): State {
  switch (action.type) {
    case 'FETCH_START':    return { ...state, loading: true };
    case 'FETCH_DONE':     return { ...state, loading: false, action: action.action };
    case 'SET_CONFIRMING': return { ...state, confirming: action.value };
    case 'EXEC_START':     return { ...state, executing: true };
    case 'EXEC_DONE':      return { ...state, executing: false, confirming: false };
    case 'SET_TEMPLATES':  return { ...state, templates: action.templates };
    case 'TOGGLE_TEMPLATE':
      return {
        ...state,
        selectedTemplateIds: state.selectedTemplateIds.includes(action.id)
          ? state.selectedTemplateIds.filter((id) => id !== action.id)
          : [...state.selectedTemplateIds, action.id],
      };
    case 'TOGGLE_DOCUMENT':
      return {
        ...state,
        selectedDocumentIds: state.selectedDocumentIds.includes(action.id)
          ? state.selectedDocumentIds.filter((id) => id !== action.id)
          : [...state.selectedDocumentIds, action.id],
      };
    default: return state;
  }
}

export function WorkflowActionButton({ legalProcessId, refreshKey, onSuccess }: Props) {
  const [{ loading, confirming, executing, action, templates, selectedTemplateIds, selectedDocumentIds }, dispatch] = useReducer(reducer, initialState);

  const fetchAction = useCallback(() => {
    dispatch({ type: 'FETCH_START' });
    getPendingManualAction(legalProcessId)
      .then((a) => dispatch({ type: 'FETCH_DONE', action: a }))
      .catch(console.error);
  }, [legalProcessId]);

  useEffect(() => {
    fetchAction();
  }, [fetchAction, refreshKey]);

  useEffect(() => {
    if (action?.kind === 'template_selection') {
      getGoogleDocTemplates()
        .then((t) => dispatch({ type: 'SET_TEMPLATES', templates: t }))
        .catch(console.error);
    }
  }, [action?.kind]);

  // ── Acción manual: resume via /api/workflow/resume ───────────────────────
  const handleManualConfirm = async () => {
    if (!action || action.kind !== 'manual_action') return;
    dispatch({ type: 'EXEC_START' });
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
      dispatch({ type: 'EXEC_DONE' });
    }
  };

  // ── Document preview: approve → generate final PDFs and resume workflow ──
  const handleApproveDocuments = async () => {
    dispatch({ type: 'EXEC_START' });
    try {
      await approveDocumentPreviews(legalProcessId);
      onSuccess();
    } catch (err) {
      console.error('[WorkflowActionButton] approveDocumentPreviews:', err);
    } finally {
      dispatch({ type: 'EXEC_DONE' });
    }
  };

  // ── Template selection: confirm selected templates and run document node ─
  const handleConfirmTemplates = async () => {
    if (selectedTemplateIds.length === 0) return;
    dispatch({ type: 'EXEC_START' });
    try {
      await confirmDocumentTemplates(legalProcessId, selectedTemplateIds);
      onSuccess();
    } catch (err) {
      console.error('[WorkflowActionButton] confirmDocumentTemplates:', err);
    } finally {
      dispatch({ type: 'EXEC_DONE' });
    }
  };

  // ── Document attachment selection: resume send_email with selected docs ──
  const handleConfirmAttachments = async () => {
    if (selectedDocumentIds.length === 0) return;
    dispatch({ type: 'EXEC_START' });
    try {
      await confirmEmailAttachments(legalProcessId, selectedDocumentIds);
      onSuccess();
    } catch (err) {
      console.error('[WorkflowActionButton] confirmEmailAttachments:', err);
    } finally {
      dispatch({ type: 'EXEC_DONE' });
    }
  };

  // ── Failed run: retry via server action ──────────────────────────────────
  const handleRetry = async () => {
    dispatch({ type: 'EXEC_START' });
    try {
      await retryFailedWorkflow(legalProcessId);
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      dispatch({ type: 'EXEC_DONE' });
    }
  };

  if (loading) {
    return <Spinner className="h-4 w-4 text-muted-foreground" />;
  }

  if (!action) return null;

  // ── Template selection state ──────────────────────────────────────────────
  if (action.kind === 'template_selection') {
    return (
      <>
        <Button size="sm" onClick={() => dispatch({ type: 'SET_CONFIRMING', value: true })} disabled={executing}>
          {executing ? (
            <Spinner className="mr-2 h-4 w-4" />
          ) : (
            <FilePlus className="mr-2 h-4 w-4" />
          )}
          {action.nodeTitle}
        </Button>

        <Dialog open={confirming} onOpenChange={(open) => { if (!open) dispatch({ type: 'SET_CONFIRMING', value: false }); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Seleccionar plantillas de documentos</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cargando plantillas...</p>
              ) : (
                templates.map((tpl) => (
                  <label key={tpl.id} className="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-muted">
                    <Checkbox
                      checked={selectedTemplateIds.includes(tpl.id)}
                      onCheckedChange={() => dispatch({ type: 'TOGGLE_TEMPLATE', id: tpl.id })}
                    />
                    <span className="text-sm">{tpl.name}</span>
                  </label>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => dispatch({ type: 'SET_CONFIRMING', value: false })} disabled={executing}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmTemplates}
                disabled={executing || selectedTemplateIds.length === 0}
              >
                {executing ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Generar documentos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── Document attachment selection state ──────────────────────────────────
  if (action.kind === 'document_attachment_selection') {
    return (
      <>
        <Button size="sm" onClick={() => dispatch({ type: 'SET_CONFIRMING', value: true })} disabled={executing}>
          {executing ? (
            <Spinner className="mr-2 h-4 w-4" />
          ) : (
            <Paperclip className="mr-2 h-4 w-4" />
          )}
          {action.nodeTitle}
        </Button>

        <Dialog open={confirming} onOpenChange={(open) => { if (!open) dispatch({ type: 'SET_CONFIRMING', value: false }); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Seleccionar documentos para adjuntar</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {action.availableDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay documentos generados disponibles.</p>
              ) : (
                action.availableDocuments.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-muted">
                    <Checkbox
                      checked={selectedDocumentIds.includes(doc.id)}
                      onCheckedChange={() => dispatch({ type: 'TOGGLE_DOCUMENT', id: doc.id })}
                    />
                    <span className="text-sm">{doc.name}</span>
                  </label>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => dispatch({ type: 'SET_CONFIRMING', value: false })} disabled={executing}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmAttachments}
                disabled={executing || selectedDocumentIds.length === 0}
              >
                {executing ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Enviar correo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── Document preview state ────────────────────────────────────────────────
  if (action.kind === 'document_preview') {
    return (
      <>
        <Button
          size="sm"
          onClick={() => dispatch({ type: 'SET_CONFIRMING', value: true })}
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
          onClose={() => dispatch({ type: 'SET_CONFIRMING', value: false })}
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
          onClick={() => dispatch({ type: 'SET_CONFIRMING', value: true })}
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
          onClose={() => dispatch({ type: 'SET_CONFIRMING', value: false })}
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
        onClick={() => dispatch({ type: 'SET_CONFIRMING', value: true })}
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
        onClose={() => dispatch({ type: 'SET_CONFIRMING', value: false })}
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
