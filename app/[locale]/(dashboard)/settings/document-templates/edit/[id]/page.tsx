import { getTemplate } from '../../actions';
import TemplateForm from '../../_components/template-form';
import { getAiVariables } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: Props) {
    const { id } = await params;
    const [template, aiVariables] = await Promise.all([
        getTemplate(id),
        getAiVariables(),
    ]);
    return (
        <div className="w-full px-4 py-8">
            <TemplateForm template={template} aiVariables={aiVariables} />
        </div>
    );
}
