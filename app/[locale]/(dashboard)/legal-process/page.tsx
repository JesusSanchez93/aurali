import ProcessList from '@/app/[locale]/(dashboard)/legal-process/_components/process-list';
import { getDocuments, getLegalProcesses, getOrgLawyers } from './actions';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import ProcessSearch from './_components/process-search';
import ProcessStatusFilter from './_components/process-status-filter';
import ProcessFormSheet from './_components/process-form-sheet';

export default async function ProcessPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale } = await props.params;
  const params = await props.searchParams;
  const pageParam = params.page;
  const page = typeof pageParam === 'string' ? parseInt(pageParam) || 1 : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const status = typeof params.status === 'string' ? params.status : undefined;
  const pageSize = 10;
  const t = await getTranslations('common.pagination');

  let processes: Awaited<ReturnType<typeof getLegalProcesses>>['processes'] = [];
  let count = 0;
  let documents: Awaited<ReturnType<typeof getDocuments>> = [];
  let lawyers: Awaited<ReturnType<typeof getOrgLawyers>> = [];
  let profile: Awaited<ReturnType<typeof getSessionProfile>>['profile'] = null;

  try {
    const [processesResult, documentsResult, lawyersResult, profileResult] = await Promise.all([
      getLegalProcesses(page, pageSize, search, status),
      getDocuments(),
      getOrgLawyers(),
      getSessionProfile(),
    ]);

    processes = processesResult.processes;
    count = processesResult.count;
    documents = documentsResult;
    lawyers = lawyersResult;
    profile = profileResult.profile;
  } catch (error) {
    const e = error as Error & { digest?: string };
    console.error('[legal-process/page] render failed', {
      locale,
      page,
      pageSize,
      search: search ?? null,
      status: status ?? null,
      message: e?.message ?? String(error),
      digest: e?.digest ?? null,
      stack: e?.stack ?? null,
    });
    throw error;
  }
  const totalPages = Math.ceil(count / pageSize);

  const options = (documents || [])?.map((e) => ({
    label: (e?.name as any)?.[locale] ?? (e?.name as any)?.es ?? '',
    value: e.id,
    key: e?.slug || '',
  }));

  const getPaginationLink = (targetPage: number) => {
    const queryParams = new URLSearchParams();
    queryParams.set('page', targetPage.toString());
    if (search) {
      queryParams.set('search', search);
    }
    if (status) {
      queryParams.set('status', status);
    }
    return `/legal-process?${queryParams.toString()}`;
  };

  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, count);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <div className="w-full sm:flex-1">
          <ProcessSearch />
        </div>
        <div className="w-full sm:w-auto">
          <ProcessStatusFilter />
        </div>
        <div className="w-full sm:w-auto">
          <ProcessFormSheet
            documents={options}
            lawyers={lawyers}
            currentUserId={profile?.id ?? ''}
          />
        </div>
      </div>
      <ProcessList
        data={processes || []}
        canViewTimeline={
          profile?.system_role === 'SUPERADMIN' || profile?.org_role === 'ORG_ADMIN'
        }
      />
      {totalPages > 1 && (
        <div className="sticky bottom-0 flex items-center justify-between bg-background/80 backdrop-blur-sm px-2 py-3">
          <div className="text-sm text-muted-foreground">
            {t('showing', { start: startIdx, end: endIdx, total: count })}
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
                  {t('previous')}
                </Link>
              ) : (
                <span className="flex items-center cursor-not-allowed text-muted-foreground">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t('previous')}
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
