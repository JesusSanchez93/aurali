import { getDocHeaders, getDocFooters } from './actions';
import DocumentTemplatesSection from '@/components/app/settings/document-templates-section';

export default async function DocumentSettingsPage() {
  const [headers, footers] = await Promise.all([getDocHeaders(), getDocFooters()]);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Cabeceras y Pies de página</h1>
        <p className="text-sm text-muted-foreground">
          Configura las cabeceras y pies de página que se asociarán a tus plantillas de documentos.
        </p>
      </div>
      <DocumentTemplatesSection headers={headers} footers={footers} />
    </div>
  );
}
