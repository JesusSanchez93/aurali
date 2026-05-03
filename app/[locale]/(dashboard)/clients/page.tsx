import { getTranslations } from 'next-intl/server';
import ClientList from '@/components/app/clients/client-list';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.clients') };
}
import { getClients } from './actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ClientSearch from '@/components/app/clients/client-search';

export default async function ClientsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.searchParams;
  const pageParam = params.page;
  const page = typeof pageParam === 'string' ? parseInt(pageParam) || 1 : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const pageSize = 10;

  const { clients, count } = await getClients(page, pageSize, search);
  const totalPages = Math.ceil(count / pageSize);

  const getPaginationLink = (targetPage: number) => {
    const queryParams = new URLSearchParams();
    queryParams.set('page', targetPage.toString());
    if (search) {
      queryParams.set('search', search);
    }
    return `/clients?${queryParams.toString()}`;
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ClientSearch />
      </div>

      <ClientList data={clients || []} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, count)} de {count} clientes
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              asChild={page > 1}
            >
              {page > 1 ? (
                <Link href={getPaginationLink(page - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Link>
              ) : (
                <span className="flex items-center cursor-not-allowed text-muted-foreground">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              asChild={page < totalPages}
            >
              {page < totalPages ? (
                <Link href={getPaginationLink(page + 1)}>
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center cursor-not-allowed text-muted-foreground">
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
