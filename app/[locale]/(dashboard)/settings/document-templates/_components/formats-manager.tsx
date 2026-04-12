'use client';

import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FormatsTable from './formats-table';

type Template = {
    id: string;
    name: string | null;
    version: number | null;
    created_at: string;
};

interface Props {
    templates: Template[];
}

export default function FormatsManager({ templates }: Props) {
    const t = useTranslations('formats');

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">{t('title')}</h2>
                    <p className="text-sm text-muted-foreground">{t('description')}</p>
                </div>
                <Button asChild>
                    <Link href="/settings/document-templates/new">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('new')}
                    </Link>
                </Button>
            </div>

            <FormatsTable templates={templates} />
        </div>
    );
}
