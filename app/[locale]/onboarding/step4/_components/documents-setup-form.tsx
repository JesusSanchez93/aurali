'use client';

import { useTransition } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { saveOrgDocuments } from '../actions';
import { useTranslations } from 'next-intl';
import { useMultiSelect } from '@/hooks/use-multi-select';

type CatalogDocument = { id: string; slug: string; name: { es?: string; en?: string } };

export function DocumentsSetupForm({ catalogDocuments }: { catalogDocuments: CatalogDocument[] }) {
  const t = useTranslations('onboarding.step4');
  const router = useRouter();

  const { selected, toggle, toArray } = useMultiSelect(catalogDocuments.map((d) => d.id));
  const [isPending, startTransition] = useTransition();

  function handleContinue() {
    if (selected.size === 0) {
      toast.error('Selecciona al menos un tipo de documento');
      return;
    }
    startTransition(async () => {
      try {
        await saveOrgDocuments(toArray());
        router.push('/onboarding/workflow-selection');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar documentos');
      }
    });
  }

  return (
    <div className="w-full max-w-screen-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Paso 4 · Documentos
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {catalogDocuments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('no_documents')}</p>
      ) : (
        <div className="space-y-1.5">
          {catalogDocuments.map((doc) => {
            const isChecked = selected.has(doc.id);
            return (
              <label
                key={doc.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-150 ${
                  isChecked
                    ? 'border-foreground bg-foreground/[0.03]'
                    : 'border-border hover:border-foreground/30 hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={isChecked}
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
            );
          })}
        </div>
      )}

      <div className="sticky bottom-0 z-10 mt-8 flex justify-between bg-background/80 py-4 backdrop-blur-sm">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link href="/onboarding/step3">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={handleContinue}
          disabled={isPending || selected.size === 0}
        >
          {isPending ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
