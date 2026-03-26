import TemplateForm from '../_components/template-form';
import { getDocHeaders, getDocFooters } from '../actions';

export default async function NewTemplatePage() {
    const [headers, footers] = await Promise.all([getDocHeaders(), getDocFooters()]);
    return <TemplateForm headers={headers} footers={footers} />;
}
