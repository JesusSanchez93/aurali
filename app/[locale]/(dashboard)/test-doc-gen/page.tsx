'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function TestDocGenPage() {
  // ── TipTap pipeline ───────────────────────────────────────────────────────
  const [tplId, setTplId] = useState('');
  const [tplData, setTplData] = useState('{}');
  const [tplLoading, setTplLoading] = useState(false);
  const [tplResult, setTplResult] = useState<string | null>(null);
  const [tplError, setTplError] = useState<string | null>(null);

  // ── Google Docs pipeline ──────────────────────────────────────────────────
  const [gdocId, setGdocId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [gdocData, setGdocData] = useState('{}');
  const [gdocLoading, setGdocLoading] = useState(false);
  const [gdocResult, setGdocResult] = useState<string | null>(null);
  const [gdocError, setGdocError] = useState<string | null>(null);

  async function handleTipTap() {
    setTplLoading(true);
    setTplResult(null);
    setTplError(null);
    try {
      const data = JSON.parse(tplData);
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: tplId, data }),
      });
      if (!res.ok) {
        const json = await res.json();
        setTplError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setTplResult(url);
    } catch (e) {
      setTplError(e instanceof Error ? e.message : String(e));
    } finally {
      setTplLoading(false);
    }
  }

  async function handleGoogleDoc() {
    setGdocLoading(true);
    setGdocResult(null);
    setGdocError(null);
    try {
      const data = JSON.parse(gdocData);
      const res = await fetch('/api/google/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleDocTemplateId: gdocId,
          organizationId: orgId,
          data,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setGdocError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setGdocResult(url);
    } catch (e) {
      setGdocError(e instanceof Error ? e.message : String(e));
    } finally {
      setGdocLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-10">
      <h1 className="text-xl font-semibold">Test: Generación de Documentos</h1>

      {/* ── TipTap ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="font-medium">Pipeline TipTap</h2>

        <div className="space-y-1">
          <Label>templateId</Label>
          <Input
            placeholder="UUID de legal_templates"
            value={tplId}
            onChange={(e) => setTplId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label>data (JSON)</Label>
          <Textarea
            rows={3}
            value={tplData}
            onChange={(e) => setTplData(e.target.value)}
          />
        </div>

        <Button onClick={handleTipTap} disabled={tplLoading || !tplId}>
          {tplLoading ? 'Generando…' : 'Generar PDF'}
        </Button>

        {tplError && <p className="text-sm text-destructive">{tplError}</p>}
        {tplResult && (
          <a
            href={tplResult}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-blue-600 underline"
          >
            Ver PDF generado
          </a>
        )}
      </section>

      {/* ── Google Docs ────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="font-medium">Pipeline Google Docs</h2>

        <div className="space-y-1">
          <Label>googleDocTemplateId</Label>
          <Input
            placeholder="UUID de google_doc_templates"
            value={gdocId}
            onChange={(e) => setGdocId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label>organizationId</Label>
          <Input
            placeholder="UUID de la organización"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label>data (JSON)</Label>
          <Textarea
            rows={3}
            value={gdocData}
            onChange={(e) => setGdocData(e.target.value)}
          />
        </div>

        <Button onClick={handleGoogleDoc} disabled={gdocLoading || !gdocId || !orgId}>
          {gdocLoading ? 'Generando…' : 'Generar PDF'}
        </Button>

        {gdocError && <p className="text-sm text-destructive">{gdocError}</p>}
        {gdocResult && (
          <a
            href={gdocResult}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-blue-600 underline"
          >
            Ver PDF generado
          </a>
        )}
      </section>
    </div>
  );
}
