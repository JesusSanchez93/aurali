import { getTemplate } from '@/app/[locale]/(dashboard)/settings/document-templates/actions';
import { OnlyOfficeEditor } from '@/components/common/onlyoffice-editor';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function FullscreenTemplateEditorPage({ params }: Props) {
    const { id } = await params;
    const template = await getTemplate(id);

    if (!template.docx_storage_path) {
        return (
            <div className="flex h-svh w-svw items-center justify-center text-sm text-muted-foreground">
                Esta plantilla no tiene un archivo .docx cargado todavía.
            </div>
        );
    }

    return (
        <div className="h-svh w-svw">
            <OnlyOfficeEditor
                configUrl={`/api/onlyoffice/templates/${id}/config`}
                className="h-full w-full"
            />
        </div>
    );
}
