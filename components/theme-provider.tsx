import { useEffect, type ReactNode } from 'react';
import { initTheme } from '@/hooks/use-theme.ts';

type ThemeProviderProps = {
  readonly children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    initTheme();
  }, []);

  return children;
}
