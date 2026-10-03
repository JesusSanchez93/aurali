'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Kanban, Plus, Scale, StickyNote } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BoardSummary, ProcessTypeOption } from '../actions';
import { CreateBoardDialog } from './create-board-dialog';

// Tonos para las columnas en la barra de resumen de cada tablero.
const SEGMENT_TONES = ['bg-primary/80', 'bg-primary/55', 'bg-primary/35', 'bg-primary/20'];

export function BoardsOverview({ boards, processTypes }: { boards: BoardSummary[]; processTypes: ProcessTypeOption[] }) {
  const t = useTranslations('process.board.list');
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {boards.map((board) => {
          const linked = !!board.workflow_template_id;
          return (
            <Link
              key={board.id}
              href={`/board/${board.id}`}
              className="group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Kanban className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{board.name}</h2>
                  <Badge variant="secondary" className="mt-1 max-w-full gap-1 font-normal">
                    {linked ? <Scale className="size-3 shrink-0" /> : <StickyNote className="size-3 shrink-0" />}
                    <span className="truncate">{linked ? board.workflow_template_name : t('free')}</span>
                  </Badge>
                </div>
                <span className="shrink-0 text-2xl font-semibold tabular-nums">{board.total}</span>
              </div>

              <div className="space-y-2">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                  {board.total > 0 &&
                    board.columns.map((column, i) =>
                      column.count > 0 ? (
                        <div
                          key={column.id}
                          className={cn(SEGMENT_TONES[Math.min(i, SEGMENT_TONES.length - 1)])}
                          style={{ width: `${(column.count / board.total) * 100}%` }}
                        />
                      ) : null,
                    )}
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {board.columns.map((column) => (
                    <li key={column.id} className="flex items-center gap-1">
                      <span className="max-w-32 truncate">{column.name}</span>
                      <span className="font-medium tabular-nums text-foreground">{column.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
        >
          <Plus className="size-5" />
          {t('create')}
        </button>
      </div>

      <CreateBoardDialog open={creating} onOpenChange={setCreating} processTypes={processTypes} />
    </div>
  );
}
