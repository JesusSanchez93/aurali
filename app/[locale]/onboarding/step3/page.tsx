import { getCatalogDocuments } from './actions';
import { DocumentsSetupForm } from './_components/documents-setup-form';

export default async function Step3Page() {
  const catalogDocuments = await getCatalogDocuments();
  return <DocumentsSetupForm catalogDocuments={catalogDocuments} />;
}
