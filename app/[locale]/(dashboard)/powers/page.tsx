'use client';

import { Button } from '@/components/ui/button';
import { Suspense, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import Tiptap from '@/components/common/tip-tap';
import { toast } from 'sonner';

export default function PowerPage() {
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [result, setResult] = useState('');

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/powers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: 'CO',
          powerType: 'ESPECIAL',
          grantor: {
            fullName: 'Juan Pérez',
            documentType: 'CC',
            documentNumber: '123456789',
            city: 'Bogotá',
          },
          attorney: {
            fullName: 'Ana Gómez',
            documentNumber: '987654321',
          },
          scope: 'Representar al otorgante ante entidades bancarias.',
        }),
      });

      const json = await res.json();

      if (json?.data?.text) {
        setResult(json.data.text);
        toast.success('Poder generado exitosamente');
      } else {
        toast.error('No se pudo generar el poder');
      }
    } catch {
      toast.error('Error al generar el poder por IA');
    } finally {
      setLoading(false);
    }
  }

  async function generatePdf() {
    setLoadingPdf(true);
    try {
      const res = await fetch('/api/pdf', { method: 'GET' });

      if (!res.ok) throw new Error('Error generando PDF');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast.success('PDF generado', { description: 'El documento fue abierto en una nueva pestaña.' });
    } catch {
      toast.error('Error al generar el PDF');
    } finally {
      setLoadingPdf(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <Button onClick={generate} size={'lg'} disabled={loading}>
        Generar poder por IA {loading && <Spinner />}
      </Button>
      <div>
        {result && (
          <Suspense fallback="Loading...">
            <Tiptap value={JSON.parse(result)} onChange={setResult} />
          </Suspense>
        )}
      </div>
      <Button size="lg" onClick={generatePdf} disabled={loadingPdf || !result}>
        Generar Documento PDF {loadingPdf && <Spinner />}
      </Button>
    </div>
  );
}
