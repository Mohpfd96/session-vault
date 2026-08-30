import { createContext, useContext, type ReactNode } from 'react';
import { useSidePanelController } from './use-sidepanel.ts';

type SidePanelController = ReturnType<typeof useSidePanelController>;

const SidePanelContext = createContext<SidePanelController | null>(null);

export function SidePanelProvider({ children }: { readonly children: ReactNode }) {
  const controller = useSidePanelController();
  return (
    <SidePanelContext.Provider value={controller}>{children}</SidePanelContext.Provider>
  );
}

export function useSidePanel(): SidePanelController {
  const context = useContext(SidePanelContext);
  if (context === null) {
    throw new Error('useSidePanel must be used within SidePanelProvider');
  }
  return context;
}
