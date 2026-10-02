import { getTranslations } from 'next-intl/server';
import { getPaymentsOverview } from './actions';
import { can } from '@/lib/auth/authorization';
import { PaymentsList } from './_components/payments-list';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.payments') };
}

export default async function PaymentsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.searchParams;
  const pageParam = params.page;
  const page = typeof pageParam === 'string' ? parseInt(pageParam) || 1 : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const pageSize = 10;
  const t = await getTranslations('common.pagination');
  const paymentsT = await getTranslations('payments');

  if (!(await can('payments.view'))) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  const { rows, count } = await getPaymentsOverview(page, pageSize, search);
  const totalPages = Math.ceil(count / pageSize);

  const getPaginationLink = (targetPage: number) => {
    const queryParams = new URLSearchParams();
    queryParams.set('page', targetPage.toString());
    if (search) queryParams.set('search', search);
    return `/payments?${queryParams.toString()}`;
  };

  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, count);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">{paymentsT('title')}</h1>
        <p className="text-sm text-muted-foreground">{paymentsT('description')}</p>
      </div>

      <PaymentsList rows={rows} initialSearch={search ?? ''} />

      {totalPages > 1 && (
        <div className="sticky bottom-0 flex items-center justify-between bg-background/80 backdrop-blur-sm px-2 py-3">
          <div className="text-sm text-muted-foreground">
            {t('showing', { start: startIdx, end: endIdx, total: count })}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
              {page > 1 ? (
                <Link href={getPaginationLink(page - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t('previous')}
                </Link>
              ) : (
                <span className="flex items-center cursor-not-allowed text-muted-foreground">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t('previous')}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
              {page < totalPages ? (
                <Link href={getPaginationLink(page + 1)}>
                  {t('next')}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center cursor-not-allowed text-muted-foreground">
                  {t('next')}
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
