import { getTemplate, getDocHeaders, getDocFooters } from '../../actions';
import TemplateForm from '../../_components/template-form';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: Props) {
    const { id } = await params;
    const [template, headers, footers] = await Promise.all([
        getTemplate(id),
        getDocHeaders(),
        getDocFooters(),
    ]);
    return <TemplateForm template={template} headers={headers} footers={footers} />;
}
