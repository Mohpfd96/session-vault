import { Loader2Icon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

type LoadingStateProps = {
  readonly label?: string;
  readonly className?: string;
};

export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
