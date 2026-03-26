import { getCatalogDocuments } from './actions';
import { DocumentsSetupForm } from './_components/documents-setup-form';

export default async function Step4Page() {
  const catalogDocuments = await getCatalogDocuments();
  return <DocumentsSetupForm catalogDocuments={catalogDocuments} />;
}
