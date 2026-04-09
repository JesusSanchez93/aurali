import { getAiVariables } from './actions';
import { AiVariablesSection } from '@/components/app/settings/ai-variables-section';
import { getTranslations } from 'next-intl/server';

export default async function AiVariablesPage() {
  const [variables, t] = await Promise.all([
    getAiVariables(),
    getTranslations('settings.ai_variables'),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <AiVariablesSection variables={variables} />
    </div>
  );
}
