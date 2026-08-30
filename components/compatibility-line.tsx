import type { CompatibilityInfo } from '@/app/types.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { cn } from '@/lib/utils.ts';

const LEVEL_LABELS: Record<CompatibilityInfo['level'], string> = {
  full: 'FULL',
  limited: 'LIMITED',
  unsupported: 'UNSUPPORTED',
};

const LEVEL_VARIANTS: Record<
  CompatibilityInfo['level'],
  'success' | 'warning' | 'destructive'
> = {
  full: 'success',
  limited: 'warning',
  unsupported: 'destructive',
};

type CompatibilityLineProps = {
  readonly compatibility: CompatibilityInfo;
  readonly className?: string;
};

export function CompatibilityLine({ compatibility, className }: CompatibilityLineProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border bg-muted/40 px-2.5 py-2',
        className,
      )}
      role="status"
      aria-label={`Compatibility ${LEVEL_LABELS[compatibility.level]}: ${compatibility.reason}`}
    >
      <Badge variant={LEVEL_VARIANTS[compatibility.level]} className="shrink-0">
        {LEVEL_LABELS[compatibility.level]}
      </Badge>
      <p className="text-muted-foreground min-w-0 text-xs leading-relaxed">
        {compatibility.reason}
      </p>
    </div>
  );
}
