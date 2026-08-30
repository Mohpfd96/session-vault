import { useCallback, useEffect, useState } from 'react';

type UseKeyboardListOptions = {
  readonly itemCount: number;
  readonly onSelect: (index: number) => void;
  readonly enabled?: boolean;
};

export function useKeyboardList({
  itemCount,
  onSelect,
  enabled = true,
}: UseKeyboardListOptions): {
  readonly focusedIndex: number;
  readonly setFocusedIndex: (index: number) => void;
  readonly handleKeyDown: (event: React.KeyboardEvent) => void;
} {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (focusedIndex >= itemCount) {
      setFocusedIndex(Math.max(0, itemCount - 1));
    }
  }, [focusedIndex, itemCount]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          setFocusedIndex((current) => Math.min(itemCount - 1, current + 1));
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          setFocusedIndex((current) => Math.max(0, current - 1));
          break;
        }
        case 'Home': {
          event.preventDefault();
          setFocusedIndex(0);
          break;
        }
        case 'End': {
          event.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
        }
        case 'Enter': {
          event.preventDefault();
          onSelect(focusedIndex);
          break;
        }
        default:
          break;
      }
    },
    [enabled, focusedIndex, itemCount, onSelect],
  );

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}
