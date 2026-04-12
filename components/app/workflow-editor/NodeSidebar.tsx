'use client';

import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { NODE_TYPES_CONFIG } from './node-config';
import type { WorkflowNodeType } from './types';

const NODE_ORDER: WorkflowNodeType[] = [
  'start',
  'client_form',
  'send_email',
  'status_update',
  'generate_document',
  'notify_lawyer',
  'manual_action',
  'end',
];

function getIcon(name: string): React.ComponentType<{ className?: string }> {
  const icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  return icon ?? LucideIcons.Circle;
}

interface NodeSidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: WorkflowNodeType) => void;
}

export function NodeSidebar({ onDragStart }: NodeSidebarProps) {
  const t = useTranslations('settings.workflow_editor');
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t('sidebar_title')}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('sidebar_hint')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {NODE_ORDER.map((type) => {
            const cfg = NODE_TYPES_CONFIG[type];
            const Icon = getIcon(cfg.icon);

            return (
              <div
                key={type}
                draggable
                onDragStart={(e) => onDragStart(e, type)}
                className="flex cursor-grab items-center gap-3 rounded-lg border bg-background px-3 py-2.5 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent active:cursor-grabbing select-none"
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                    cfg.colorClass,
                  )}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{cfg.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{cfg.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
