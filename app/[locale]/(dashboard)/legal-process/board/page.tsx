import { getTranslations } from 'next-intl/server';
import { getBoardData } from '@/app/[locale]/(dashboard)/legal-process/board-actions';
import { LegalProcessBoard } from '@/app/[locale]/(dashboard)/legal-process/_components/legal-process-board';

export default async function LegalProcessBoardPage() {
  const [t, board] = await Promise.all([
    getTranslations('process.board'),
    getBoardData(),
  ]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <LegalProcessBoard initialColumns={board.columns} initialCards={board.cards} />
    </div>
  );
}
