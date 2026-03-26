'use client';

import { useState, useTransition } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { saveOrgBanks } from '../actions';
import { useTranslations } from 'next-intl';

type CatalogBank = { id: string; name: string; code: string; slug: string };

export function BanksSetupForm({ catalogBanks }: { catalogBanks: CatalogBank[] }) {
  const t = useTranslations('onboarding.step3');
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set(catalogBanks.map((b) => b.id)));
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
      toast.error('Selecciona al menos un banco');
      return;
    }
    startTransition(async () => {
      try {
        await saveOrgBanks(Array.from(selected));
        router.push('/onboarding/step4');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar bancos');
      }
    });
  }

  return (
    <div className="w-full max-w-screen-sm space-y-8">
      <div className="mb-12">
        <span className="text-2xl">{t('title')}</span>
        <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {catalogBanks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('no_banks')}</p>
      ) : (
        <div className="space-y-2">
          {catalogBanks.map((bank) => (
            <label
              key={bank.id}
              className="flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <Checkbox
                checked={selected.has(bank.id)}
                onCheckedChange={() => toggle(bank.id)}
              />
              <span className="flex-1 text-sm font-medium">{bank.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {bank.code}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link href="/onboarding/step2">
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
