import { redirect } from '@/i18n/routing';
import { ORG_CATALOG_KEYS } from '@/lib/catalogs/registry';

export default async function CatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: `/admin/catalog/${ORG_CATALOG_KEYS[0]}`, locale });
}
