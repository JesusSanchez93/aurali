'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getLegalProcesses, getProcessTemplateData } from '../legal-process/actions';
import { getTemplates } from '../settings/document-templates/actions';
import { getGoogleDocTemplates } from '../settings/google-templates/actions';

type ProcessOption = {
  id: string;
  process_number: number | null;
  status: string | null;
  email: string | null;
  document_number: string | null;
  organization_id: string;
  created_at: string;
  client: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

type DocOption = { key: string; label: string };

type ProgressStep = { step: number; total: number; label: string; done: boolean };

export default function TestDocGenPage() {
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [docOptions, setDocOptions] = useState<DocOption[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [selectedDocKey, setSelectedDocKey] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [processData, setProcessData] = useState<Record<string, string> | null>(null);
  const [processDataLoading, setProcessDataLoading] = useState(false);
  const [processDataError, setProcessDataError] = useState<string | null>(null);

  const [caseLoading, setCaseLoading] = useState(false);
  const [caseResult, setCaseResult] = useState<string | null>(null);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);

  const selectedProcess = processes.find((p) => p.id === selectedProcessId) ?? null;

  useEffect(() => {
    (async () => {
      try {
        const [{ processes: procs }, legalTemplates, googleTemplates] = await Promise.all([
          getLegalProcesses(1, 10),
          getTemplates(),
          getGoogleDocTemplates(),
        ]);
        setProcesses(procs as ProcessOption[]);
        setDocOptions([
          ...legalTemplates.map((t) => ({ key: `legal:${t.id}`, label: `${t.name} (TipTap)` })),
          ...googleTemplates.map((t) => ({ key: `google:${t.id}`, label: `${t.name} (Google Doc)` })),
        ]);
      } catch (e) {
        setOptionsError(e instanceof Error ? e.message : String(e));
      } finally {
        setOptionsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProcessId) {
      setProcessData(null);
      return;
    }
    setProcessDataLoading(true);
    setProcessDataError(null);
    getProcessTemplateData(selectedProcessId)
      .then(setProcessData)
      .catch((e) => setProcessDataError(e instanceof Error ? e.message : String(e)))
      .finally(() => setProcessDataLoading(false));
  }, [selectedProcessId]);

  async function handleGenerateFromCase() {
    setCaseLoading(true);
    setCaseResult(null);
    setCaseError(null);
    setSteps([]);
    try {
      const process = processes.find((p) => p.id === selectedProcessId);
      if (!process) throw new Error('Selecciona un caso');
      const [type, docId] = selectedDocKey.split(':');
      if (!type || !docId) throw new Error('Selecciona un documento');

      const data = processData ?? (await getProcessTemplateData(selectedProcessId));

      const body =
        type === 'google'
          ? {
              pipeline: 'google',
              googleDocTemplateId: docId,
              organizationId: process.organization_id,
              legalProcessId: selectedProcessId,
              data,
            }
          : {
              pipeline: 'legal',
              templateId: docId,
              legalProcessId: selectedProcessId,
              data,
            };

      const res = await fetch('/api/documents/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        setCaseError(json.error ?? `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as
            | { type: 'progress'; step: number; total: number; label: string }
            | { type: 'complete'; fileName: string; pdfBase64: string }
            | { type: 'error'; message: string };

          if (evt.type === 'progress') {
            setSteps((prev) => [
              ...prev.map((s) => ({ ...s, done: true })),
              { step: evt.step, total: evt.total, label: evt.label, done: false },
            ]);
          } else if (evt.type === 'complete') {
            setSteps((prev) => prev.map((s) => ({ ...s, done: true })));
            const byteChars = atob(evt.pdfBase64);
            const bytes = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'application/pdf' });
            setCaseResult(URL.createObjectURL(blob));
          } else if (evt.type === 'error') {
            setCaseError(evt.message);
          }
        }
      }
    } catch (e) {
      setCaseError(e instanceof Error ? e.message : String(e));
    } finally {
      setCaseLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10">
      <h1 className="text-xl font-semibold">Test: Generación de Documentos</h1>

      {/* ── Generar desde caso ─────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="font-medium">Generar desde caso</h2>
        <p className="text-sm text-muted-foreground">
          Selecciona un caso reciente y un documento para generarlo con los datos reales del
          caso, sin pasar por todo el flujo legal. Usa datos reales del caso (incluye variables
          de IA), pero el PDF generado es solo para prueba: no se sube a Storage ni se asocia al
          proceso.
        </p>

        {optionsError && <p className="text-sm text-destructive">{optionsError}</p>}

        <div className="space-y-1">
          <Label>Caso</Label>
          <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
            <SelectTrigger>
              <SelectValue placeholder={optionsLoading ? 'Cargando…' : 'Selecciona un caso'} />
            </SelectTrigger>
            <SelectContent>
              {processes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  #{p.process_number ?? '—'} —{' '}
                  {[p.client?.first_name, p.client?.last_name].filter(Boolean).join(' ') ||
                    'Sin cliente'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Documento</Label>
          <Select value={selectedDocKey} onValueChange={setSelectedDocKey}>
            <SelectTrigger>
              <SelectValue placeholder={optionsLoading ? 'Cargando…' : 'Selecciona un documento'} />
            </SelectTrigger>
            <SelectContent>
              {docOptions.map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGenerateFromCase}
          disabled={caseLoading || !selectedProcessId || !selectedDocKey}
        >
          {caseLoading ? 'Generando…' : 'Generar y ver PDF'}
        </Button>

        {steps.length > 0 && (
          <ul className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
            {steps.map((s) => (
              <li key={s.step} className="flex items-center gap-2">
                <span
                  className={
                    s.done
                      ? 'text-green-600'
                      : 'animate-pulse text-muted-foreground'
                  }
                >
                  {s.done ? '✓' : '…'}
                </span>
                <span>
                  Paso {s.step}/{s.total} — {s.label}
                </span>
              </li>
            ))}
          </ul>
        )}

        {caseError && <p className="text-sm text-destructive">{caseError}</p>}
        {caseResult && (
          <a
            href={caseResult}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-blue-600 underline"
          >
            Ver PDF generado
          </a>
        )}
      </section>

      {/* ── Información del proceso ───────────────────────────────────────── */}
      {selectedProcessId && (
        <section className="space-y-4 rounded-lg border p-6">
          <h2 className="font-medium">Información del proceso</h2>
          <p className="text-sm text-muted-foreground">
            Datos del caso seleccionado, para validar contra el documento generado.
          </p>

          {selectedProcess && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Número: </span>
                {selectedProcess.process_number ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Estado: </span>
                {selectedProcess.status ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Cliente: </span>
                {[selectedProcess.client?.first_name, selectedProcess.client?.last_name]
                  .filter(Boolean)
                  .join(' ') || '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Email: </span>
                {selectedProcess.client?.email ?? selectedProcess.email ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Documento: </span>
                {selectedProcess.document_number ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Creado: </span>
                {new Date(selectedProcess.created_at).toLocaleString()}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Variables usadas en la generación ({'{GRUPO.VARIABLE}'})
            </h3>
            {processDataLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {processDataError && <p className="text-sm text-destructive">{processDataError}</p>}
            {processData && (
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(processData).map(([key, value]) => (
                      <tr key={key} className="border-b last:border-0">
                        <td className="whitespace-nowrap p-2 align-top font-mono text-xs text-muted-foreground">
                          {key}
                        </td>
                        <td className="p-2 align-top break-words">{value || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
