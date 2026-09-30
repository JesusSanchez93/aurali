'use client';

import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { GroupNode as GroupNodeT } from '../types';

export const GroupNode = memo(function GroupNode({ data, selected }: NodeProps<GroupNodeT>) {
  return (
    <div
      className={cn(
        'h-full w-full rounded-xl border-2 border-dashed bg-muted/20 transition-colors',
        selected ? 'border-primary' : 'border-border',
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        lineClassName="!border-primary"
        handleClassName="!h-2 !w-2 !rounded-full !border !border-primary !bg-background"
      />
      <span className="absolute -top-6 left-0 text-xs font-medium text-muted-foreground">
        {data.title}
      </span>
    </div>
  );
});
