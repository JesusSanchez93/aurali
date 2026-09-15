import { getCatalogBanks, getCatalogDocuments } from './actions';
import { CatalogBanksSection } from './_components/catalog-banks-section';
import { CatalogDocumentsSection } from './_components/catalog-documents-section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default async function CatalogPage() {
  const [banks, documents] = await Promise.all([
    getCatalogBanks(),
    getCatalogDocuments(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Catálogo global</h1>
        <p className="text-sm text-muted-foreground">
          Configura los registros disponibles para todas las organizaciones durante el onboarding.
        </p>
      </div>

      <Tabs defaultValue="banks">
        <TabsList>
          <TabsTrigger value="banks">Bancos</TabsTrigger>
          <TabsTrigger value="documents">Tipos de documento</TabsTrigger>
        </TabsList>

        <TabsContent value="banks" className="mt-6">
          <CatalogBanksSection initialBanks={banks} documentTypes={documents} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <CatalogDocumentsSection initialDocuments={documents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
