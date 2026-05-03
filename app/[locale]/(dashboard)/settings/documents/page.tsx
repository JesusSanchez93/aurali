import { getTranslations } from 'next-intl/server';
import { getOrgDocuments, getCatalogDocumentsForOrg } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.document_types') };
}
import { DocumentsSection } from './_components/documents-section';

export default async function DocumentsSettingsPage() {
  const [documents, catalogDocuments] = await Promise.all([
    getOrgDocuments(),
    getCatalogDocumentsForOrg(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <DocumentsSection initialDocuments={documents} catalogDocuments={catalogDocuments} />
    </div>
  );
}
