import { AlertCircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

type ErrorStateProps = {
  readonly message: string;
  readonly className?: string;
};

export function ErrorState({ message, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs',
        className,
      )}
      role="alert"
    >
      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}
