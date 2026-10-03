import { getTranslations } from 'next-intl/server';
import { getAvailableProcessTypes, listBoards } from './actions';
import { BoardsOverview } from './_components/boards-overview';

export async function generateMetadata() {
  const t = await getTranslations('process.board.list');
  return { title: t('title') };
}

export default async function BoardsPage() {
  const [boards, processTypes] = await Promise.all([listBoards(), getAvailableProcessTypes()]);

  return (
    <div className="p-4 md:p-6">
      <BoardsOverview boards={boards} processTypes={processTypes} />
    </div>
  );
}
