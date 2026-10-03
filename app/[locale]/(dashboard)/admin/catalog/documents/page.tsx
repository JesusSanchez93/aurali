import { getCatalogDocuments } from '../actions';
import { CatalogDocumentsSection } from '../_components/catalog-documents-section';

export default async function CatalogDocumentsPage() {
  const documents = await getCatalogDocuments();

  return <CatalogDocumentsSection initialDocuments={documents} />;
}
