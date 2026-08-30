import { isLightSwatch } from '@/modules/domain/session-factory.ts';
import { cn } from '@/lib/utils.ts';

type SessionAvatarProps = {
  readonly color: string;
  readonly icon: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
};

const SIZE_CLASS = {
  sm: 'size-6 text-sm',
  md: 'size-8 text-base',
  lg: 'size-10 text-lg',
} as const;

export function SessionAvatar({
  color,
  icon,
  size = 'md',
  className,
}: SessionAvatarProps) {
  const light = isLightSwatch(color);
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg leading-none',
        SIZE_CLASS[size],
        light ? 'ring-1 ring-black/10' : '',
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
