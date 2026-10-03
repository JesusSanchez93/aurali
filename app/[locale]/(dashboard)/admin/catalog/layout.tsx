import type { ReactNode } from 'react';
import { CatalogNav } from './_components/catalog-nav';

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Catálogo global</h1>
        <p className="text-sm text-muted-foreground">
          Registros base de cada listado. Las organizaciones eligen de aquí los que usan.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
        <aside className="md:sticky md:top-[calc(var(--header-height)+1.5rem)] md:self-start">
          <CatalogNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
