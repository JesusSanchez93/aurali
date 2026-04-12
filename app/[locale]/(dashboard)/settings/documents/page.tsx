import { getOrgDocuments, getCatalogDocumentsForOrg } from './actions';
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
