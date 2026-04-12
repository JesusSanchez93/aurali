import TemplateForm from '../_components/template-form';
import { getAiVariables } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';

export default async function NewTemplatePage() {
    const aiVariables = await getAiVariables();
    return (
        <div className="w-full px-4 py-8">
            <TemplateForm aiVariables={aiVariables} />
        </div>
    );
}
