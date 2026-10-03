import { getCatalogBanks, getCatalogDocuments } from '../actions';
import { CatalogBanksSection } from '../_components/catalog-banks-section';

export default async function CatalogBanksPage() {
  const [banks, documents] = await Promise.all([getCatalogBanks(), getCatalogDocuments()]);

  return <CatalogBanksSection initialBanks={banks} documentTypes={documents} />;
}
