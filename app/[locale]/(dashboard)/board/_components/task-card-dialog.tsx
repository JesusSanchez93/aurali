'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, Loader2, MessageSquare, Send, Trash2, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from '@/lib/toast';
import type { TaskCard } from '@/app/[locale]/(dashboard)/legal-process/board-actions';
import {
  addTaskCardComment,
  deleteTaskCard,
  getBoardMembers,
  getTaskCardDetail,
  updateTaskCard,
  type OrgMemberOption,
  type TaskCardDetail,
} from '../actions';

interface Props {
  cardId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: (id: string, fields: Partial<TaskCard>) => void;
  onDeleted: (id: string) => void;
}

const UNASSIGNED = '__none__';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

/** Detalle de una tarjeta a mano: se guarda cada campo al salir de él. */
export function TaskCardDialog({ cardId, onOpenChange, onChanged, onDeleted }: Props) {
  const t = useTranslations('process.board.task_dialog');
  const [detail, setDetail] = useState<TaskCardDetail | null>(null);
  const [members, setMembers] = useState<OrgMemberOption[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    Promise.all([getTaskCardDetail(cardId), getBoardMembers()])
      .then(([data, memberList]) => {
        if (cancelled) return;
        setDetail(data);
        setMembers(memberList);
        setTitle(data.title);
        setDescription(data.description ?? '');
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : t('load_error')));
    return () => {
      cancelled = true;
      setDetail(null);
      setComment('');
    };
  }, [cardId, t]);

  const save = async (fields: Parameters<typeof updateTaskCard>[1], local: Partial<TaskCard>) => {
    if (!detail) return;
    try {
      await updateTaskCard(detail.id, fields);
      setDetail((prev) => (prev ? { ...prev, ...fields } as TaskCardDetail : prev));
      onChanged(detail.id, local);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('save_error'));
    }
  };

  const saveTitle = () => {
    const value = title.trim();
    if (!detail || value === detail.title) return;
    if (!value) {
      setTitle(detail.title);
      return;
    }
    void save({ title: value }, { title: value });
  };

  const saveDescription = () => {
    if (!detail || description === (detail.description ?? '')) return;
    const value = description.trim() ? description : null;
    void save({ description: value }, { description: value });
  };

  const postComment = async () => {
    if (!detail || !comment.trim() || posting) return;
    setPosting(true);
    try {
      const created = await addTaskCardComment(detail.id, comment);
      const comments = [...detail.comments, created];
      setDetail({ ...detail, comments });
      onChanged(detail.id, { comments_count: comments.length });
      setComment('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('comment_error'));
    } finally {
      setPosting(false);
    }
  };

  const remove = async () => {
    if (!detail) return;
    try {
      await deleteTaskCard(detail.id);
      toast.success(t('deleted'));
      onDeleted(detail.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('delete_error'));
    }
  };

  return (
    <Dialog open={!!cardId} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">{detail?.title ?? t('loading')}</DialogTitle>
        <DialogDescription className="sr-only">{t('a11y_description')}</DialogDescription>

        {!detail ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
            {/* Izquierda: datos de la tarjeta */}
            <div className="space-y-4 p-5 md:w-1/2 md:overflow-y-auto md:border-r">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                maxLength={200}
                aria-label={t('title')}
                className="h-auto border-transparent px-2 py-1 text-lg font-semibold shadow-none hover:border-input focus-visible:border-input"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" />
                    {t('assignee')}
                  </Label>
                  <Select
                    value={detail.assigned_to ?? UNASSIGNED}
                    onValueChange={(value) => {
                      const assigned = value === UNASSIGNED ? null : value;
                      void save(
                        { assigned_to: assigned },
                        { assigned_to: assigned, assignee_name: members.find((m) => m.id === assigned)?.name ?? null },
                      );
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>{t('unassigned')}</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="task-due-date" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {t('due_date')}
                  </Label>
                  <Input
                    id="task-due-date"
                    type="date"
                    className="h-9"
                    value={detail.due_date ?? ''}
                    onChange={(e) => void save({ due_date: e.target.value || null }, { due_date: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-description" className="text-xs text-muted-foreground">
                  {t('description')}
                </Label>
                <Textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  placeholder={t('description_placeholder')}
                  maxLength={5000}
                  className="min-h-32 text-base md:text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                <span className="truncate">
                  {detail.creator_name ? t('created_by', { name: detail.creator_name }) : null}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive hover:bg-destructive/15 hover:text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('delete')}
                </Button>
              </div>
            </div>

            {/* Derecha: comentarios */}
            <div className="flex min-h-80 flex-col md:w-1/2">
              <h4 className="flex items-center gap-2 px-5 pt-5 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" />
                {t('comments_title')}
              </h4>
              <div className="m-3 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg bg-muted/50 p-3">
                {detail.comments.length === 0 && (
                  <p className="text-center text-xs italic text-muted-foreground">{t('comments_empty')}</p>
                )}
                {detail.comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">{initials(c.author_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-xs font-medium">{c.author_name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleString('es-CO', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words rounded-md bg-background p-2 text-sm shadow-sm">
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {/* En móvil todo el diálogo hace scroll: el campo y el botón de enviar quedan fijos abajo. */}
              <div className="sticky bottom-0 z-10 flex items-start gap-2 border-t bg-background px-5 pb-5 pt-3 md:static">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('comment_placeholder')}
                  className="min-h-16 text-base md:text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void postComment();
                  }}
                />
                <Button size="icon" disabled={posting || !comment.trim()} onClick={() => void postComment()} aria-label={t('comment_send')}>
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title={t('delete_confirm_title')}
          description={t('delete_confirm_description')}
          variant="destructive"
          onConfirm={() => {
            setConfirmingDelete(false);
            void remove();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
