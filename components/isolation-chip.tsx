import type { IsolationChipStatus } from '@/app/types.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { cn } from '@/lib/utils.ts';

export function shouldShowIsolationChip(status: IsolationChipStatus): boolean {
  return status === 'isolated' || status === 'degraded';
}

const STATUS_LABELS: Record<IsolationChipStatus, string> = {
  off: 'Off',
  isolated: 'Isolated',
  degraded: 'Degraded',
  unassigned: 'Unassigned',
};

const STATUS_VARIANTS: Record<
  IsolationChipStatus,
  'muted' | 'success' | 'warning' | 'destructive'
> = {
  off: 'muted',
  isolated: 'success',
  degraded: 'warning',
  unassigned: 'warning',
};

type IsolationChipProps = {
  readonly status: IsolationChipStatus;
  readonly className?: string;
};

export function IsolationChip({ status, className }: IsolationChipProps) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      className={cn('font-medium tracking-wide uppercase', className)}
      aria-label={`Isolation status: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
