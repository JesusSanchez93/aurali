import TemplateForm from '../_components/template-form';
import { getDocHeaders, getDocFooters } from '../actions';
import { getAiVariables } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';

export default async function NewTemplatePage() {
    const [headers, footers, aiVariables] = await Promise.all([
        getDocHeaders(),
        getDocFooters(),
        getAiVariables(),
    ]);
    return <TemplateForm headers={headers} footers={footers} aiVariables={aiVariables} />;
}
