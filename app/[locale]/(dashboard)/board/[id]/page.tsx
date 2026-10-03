import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getBoardData } from '@/app/[locale]/(dashboard)/legal-process/board-actions';
import { BoardHeader } from '../_components/board-header';
import { BoardView } from '../_components/board-view';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Metadata y página piden el mismo tablero: una sola carga por request.
const loadBoard = cache((id: string) => (UUID.test(id) ? getBoardData(id) : Promise.resolve(null)));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = await loadBoard(id);
  return { title: board?.board.name ?? 'Tablero' };
}

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = await loadBoard(id);
  if (!board) notFound();

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BoardHeader board={board.board} />
      <BoardView key={board.board.id} initial={board} />
    </div>
  );
}
