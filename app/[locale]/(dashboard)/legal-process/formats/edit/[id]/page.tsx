import { getTemplate, getDocHeaders, getDocFooters } from '../../actions';
import TemplateForm from '../../_components/template-form';
import { getAiVariables } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: Props) {
    const { id } = await params;
    const [template, headers, footers, aiVariables] = await Promise.all([
        getTemplate(id),
        getDocHeaders(),
        getDocFooters(),
        getAiVariables(),
    ]);
    return <TemplateForm template={template} headers={headers} footers={footers} aiVariables={aiVariables} />;
}
