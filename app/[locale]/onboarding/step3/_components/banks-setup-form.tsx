'use client';

import { useTransition } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { saveOrgBanks } from '../actions';
import { useTranslations } from 'next-intl';
import { useMultiSelect } from '@/hooks/use-multi-select';

type CatalogBank = { id: string; name: string; code: string; slug: string };

export function BanksSetupForm({ catalogBanks }: { catalogBanks: CatalogBank[] }) {
  const t = useTranslations('onboarding.step3');
  const router = useRouter();

  const { selected, toggle, toArray } = useMultiSelect(catalogBanks.map((b) => b.id));
  const [isPending, startTransition] = useTransition();

  function handleContinue() {
    if (selected.size === 0) {
      toast.error('Selecciona al menos un banco');
      return;
    }
    startTransition(async () => {
      try {
        await saveOrgBanks(toArray());
        router.push('/onboarding/step4');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar bancos');
      }
    });
  }

  return (
    <div className="w-full max-w-screen-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Paso 3 · Bancos
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {catalogBanks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('no_banks')}</p>
      ) : (
        <div className="space-y-1.5">
          {catalogBanks.map((bank) => {
            const isChecked = selected.has(bank.id);
            return (
              <label
                key={bank.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-150 ${
                  isChecked
                    ? 'border-foreground bg-foreground/[0.03]'
                    : 'border-border hover:border-foreground/30 hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggle(bank.id)}
                />
                <span className="flex-1 text-sm font-medium">{bank.name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {bank.code}
                </span>
              </label>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-0 z-10 mt-8 flex justify-between bg-background/80 py-4 backdrop-blur-sm">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link href="/onboarding/step2">
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
