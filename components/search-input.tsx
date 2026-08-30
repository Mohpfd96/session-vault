import { SearchIcon } from 'lucide-react';
import type { Ref } from 'react';
import { Input } from '@/components/ui/input.tsx';
import { cn } from '@/lib/utils.ts';

type SearchInputProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly ariaLabel?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search sessions…',
  className,
  inputRef,
  ariaLabel = 'Search sessions',
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-8"
      />
    </div>
  );
}
