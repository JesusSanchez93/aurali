'use client';

import { useState, useTransition } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { saveOrgDocuments } from '../actions';
import { useTranslations } from 'next-intl';

type CatalogDocument = { id: string; slug: string; name: { es?: string; en?: string } };

export function DocumentsSetupForm({ catalogDocuments }: { catalogDocuments: CatalogDocument[] }) {
  const t = useTranslations('onboarding.step4');
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set(catalogDocuments.map((d) => d.id)));
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleContinue() {
    if (selected.size === 0) {
      toast.error('Selecciona al menos un tipo de documento');
      return;
    }
    startTransition(async () => {
      try {
        await saveOrgDocuments(Array.from(selected));
        router.push('/onboarding/workflow-selection');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar documentos');
      }
    });
  }

  return (
    <div className="w-full max-w-screen-sm space-y-8">
      <div className="mb-12">
        <span className="text-2xl">{t('title')}</span>
        <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {catalogDocuments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('no_documents')}</p>
      ) : (
        <div className="space-y-2">
          {catalogDocuments.map((doc) => (
            <label
              key={doc.id}
              className="flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <Checkbox
                checked={selected.has(doc.id)}
                onCheckedChange={() => toggle(doc.id)}
              />
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
                {doc.slug}
              </span>
              <span className="flex-1 text-sm">{doc.name.es}</span>
              {doc.name.en && doc.name.en !== doc.name.es && (
                <span className="text-xs text-muted-foreground">{doc.name.en}</span>
              )}
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link href="/onboarding/step3">
            <ArrowLeft />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={handleContinue}
          disabled={isPending || selected.size === 0}
        >
          {isPending ? <Spinner /> : <ArrowRight />}
        </Button>
      </div>
    </div>
  );
}
