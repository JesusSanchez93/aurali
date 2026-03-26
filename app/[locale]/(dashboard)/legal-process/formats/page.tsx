import { getTemplates } from './actions';
import FormatsManager from './_components/formats-manager';

export default async function FormatsPage() {
    const templates = await getTemplates();
    return <FormatsManager templates={templates} />;
}
