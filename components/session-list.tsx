import type { SessionListItem } from '@/app/types.ts';
import { SessionRow } from '@/components/session-row.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { cn } from '@/lib/utils.ts';

type SessionListProps = {
  readonly items: readonly SessionListItem[];
  readonly currentSessionId?: string | null;
  readonly focusedIndex?: number;
  readonly selectedSessionId?: string | null;
  readonly onSelect?: (item: SessionListItem, index: number) => void;
  readonly onActivate?: (item: SessionListItem, index: number) => void;
  readonly onRename?: (item: SessionListItem) => void;
  readonly onDelete?: (item: SessionListItem) => void;
  readonly emptyLabel?: string;
  readonly className?: string;
  readonly maxHeight?: string;
  readonly hint?: string;
};

export function SessionList({
  items,
  currentSessionId = null,
  focusedIndex = -1,
  selectedSessionId = null,
  onSelect,
  onActivate,
  onRename,
  onDelete,
  emptyLabel = 'No sessions match your search.',
  className,
  maxHeight = '240px',
  hint,
}: SessionListProps) {
  if (items.length === 0) {
    return (
      <p className={cn('text-muted-foreground px-2 py-6 text-center text-xs', className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ScrollArea className={cn('pr-1', className)} style={{ maxHeight }}>
      <div role="listbox" aria-label="Sessions" className="flex flex-col gap-0.5 p-1">
        {items.map((item, index) => (
          <SessionRow
            key={item.session.id}
            item={item}
            current={currentSessionId === item.session.id}
            selected={selectedSessionId === item.session.id}
            focused={focusedIndex === index}
            onClick={() => onSelect?.(item, index)}
            onDoubleClick={() => onActivate?.(item, index)}
            {...(hint !== undefined ? { hint } : {})}
            {...(onRename !== undefined ? { onRename: () => onRename(item) } : {})}
            {...(onDelete !== undefined ? { onDelete: () => onDelete(item) } : {})}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
