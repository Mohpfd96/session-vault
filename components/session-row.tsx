import { ArrowUpRightIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import type { SessionListItem } from '@/app/types.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

type SessionRowProps = {
  readonly item: SessionListItem;
  readonly selected?: boolean;
  readonly focused?: boolean;
  readonly current?: boolean;
  readonly hint?: string;
  readonly onClick?: () => void;
  readonly onDoubleClick?: () => void;
  readonly onRename?: () => void;
  readonly onDelete?: () => void;
  readonly className?: string;
};

function RowIconButton({
  label,
  onClick,
  destructive = false,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly destructive?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn(
            'text-muted-foreground hover:text-foreground size-7',
            destructive && 'hover:text-destructive',
          )}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function SessionRow({
  item,
  selected = false,
  focused = false,
  current = false,
  hint,
  onClick,
  onDoubleClick,
  onRename,
  onDelete,
  className,
}: SessionRowProps) {
  const { session, tabCount } = item;
  const hasActions = onRename !== undefined || onDelete !== undefined;

  return (
    <div
      data-slot="session-row"
      className={cn(
        'group relative flex w-full items-center gap-1 rounded-lg border border-transparent pr-1 text-left transition-colors',
        (selected || focused) && 'bg-accent/80 border-border',
        current && 'bg-accent/50',
        !selected && !focused && !current && 'hover:bg-accent/70',
        className,
      )}
    >
      <span
        className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full"
        style={{ backgroundColor: session.color }}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        aria-label={`${session.name}, ${session.kind}, ${tabCount} tabs${current ? ', current session' : ''}${hint !== undefined ? `, ${hint}` : ''}`}
        aria-current={current ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-1 pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1 pl-2.5">
          <span className="flex items-center gap-1.5">
            <span className="block truncate text-sm font-medium">{session.name}</span>
            {current ? (
              <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                This tab
              </Badge>
            ) : null}
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <span className="capitalize">{session.kind}</span>
            <span aria-hidden="true">·</span>
            <span>
              {tabCount} tab{tabCount === 1 ? '' : 's'}
            </span>
          </span>
        </span>
        {hint !== undefined && !current && !hasActions ? (
          <span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center gap-0.5 text-[11px] font-medium">
            {hint}
            <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
          </span>
        ) : !hasActions ? (
          <span
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
            aria-label={`${tabCount} tabs`}
          >
            {tabCount}
          </span>
        ) : null}
      </button>
      {hasActions ? (
        <span className="flex shrink-0 items-center">
          {hint !== undefined && !current ? (
            <RowIconButton label={hint} onClick={() => onClick?.()}>
              <ArrowUpRightIcon className="size-3.5" />
            </RowIconButton>
          ) : null}
          {onRename !== undefined ? (
            <RowIconButton label="Rename" onClick={onRename}>
              <PencilIcon className="size-3.5" />
            </RowIconButton>
          ) : null}
          {onDelete !== undefined ? (
            <RowIconButton label="Delete" onClick={onDelete} destructive>
              <Trash2Icon className="size-3.5" />
            </RowIconButton>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
