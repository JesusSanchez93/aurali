import { getTemplates } from './actions';
import FormatsManager from './_components/formats-manager';

export default async function DocumentTemplatesPage() {
    const templates = await getTemplates();
    return (
        <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
            <FormatsManager templates={templates} />
        </div>
    );
}
