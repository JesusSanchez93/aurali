'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, MoreHorizontal, Pencil, Scale, StickyNote, Trash2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from '@/lib/toast';
import type { BoardInfo } from '@/app/[locale]/(dashboard)/legal-process/board-actions';
import { deleteBoard, renameBoard } from '../actions';

export function BoardHeader({ board }: { board: BoardInfo }) {
  const t = useTranslations('process.board.detail');
  const router = useRouter();
  const [name, setName] = useState(board.name);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const linked = !!board.workflow_template_id;

  const saveName = () => {
    setEditing(false);
    const value = name.trim();
    if (!value || value === board.name) {
      setName(board.name);
      return;
    }
    startTransition(async () => {
      try {
        await renameBoard(board.id, value);
      } catch (err) {
        setName(board.name);
        toast.error(err instanceof Error ? err.message : t('rename_error'));
      }
    });
  };

  const remove = () => {
    startTransition(async () => {
      try {
        await deleteBoard(board.id);
        toast.success(t('deleted'));
        router.push('/board');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('delete_error'));
      }
    });
  };

  return (
    <div className="flex items-start gap-3">
      <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0" aria-label={t('back')} title={t('back')}>
        <Link href="/board">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') {
                setName(board.name);
                setEditing(false);
              }
            }}
            className="h-9 max-w-md text-xl font-semibold"
          />
        ) : (
          <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="gap-1 font-normal">
            {linked ? <Scale className="size-3" /> : <StickyNote className="size-3" />}
            {linked ? board.workflow_template_name : t('free')}
          </Badge>
          <span>{linked ? t('linked_hint') : t('free_hint')}</span>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" disabled={isPending} aria-label={t('actions')}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            {t('rename')}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        isOpen={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={t('delete_confirm_title')}
        description={linked ? t('delete_confirm_linked') : t('delete_confirm_free')}
        variant="destructive"
        onConfirm={() => {
          setConfirmingDelete(false);
          remove();
        }}
      />
    </div>
  );
}
