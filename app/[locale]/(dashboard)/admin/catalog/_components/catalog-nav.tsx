'use client';

import { Building2, IdCard, List, type LucideIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { ORG_CATALOGS, ORG_CATALOG_KEYS, type OrgCatalogKey } from '@/lib/catalogs/registry';
import { cn } from '@/lib/utils';

const ICONS: Partial<Record<OrgCatalogKey, LucideIcon>> = {
  banks: Building2,
  documents: IdCard,
};

/** Un ítem por listado del registro: cada uno vive en /admin/catalog/<clave>. */
export function CatalogNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Listados del catálogo" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {ORG_CATALOG_KEYS.map((key) => {
        const href = `/admin/catalog/${key}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = ICONS[key] ?? List;
        const catalog = ORG_CATALOGS[key];

        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              {catalog.label}
              <span className="hidden text-xs font-normal text-muted-foreground md:block">
                {catalog.scope === 'global' ? 'Global' : 'Propio del proceso'}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
