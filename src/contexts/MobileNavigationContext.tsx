import { createContext, useContext, useState, ReactNode } from 'react';

interface MobileNavigationContextType {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  activePage: string;
  setActivePage: (page: string) => void;
}

const MobileNavigationContext = createContext<MobileNavigationContextType | undefined>(undefined);

export function MobileNavigationProvider({ children }: { children: ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activePage, setActivePage] = useState('/purchase-orders');

  return (
    <MobileNavigationContext.Provider
      value={{
        isDrawerOpen,
        setIsDrawerOpen,
        activePage,
        setActivePage,
      }}
    >
      {children}
    </MobileNavigationContext.Provider>
  );
}

export function useMobileNavigation() {
  const context = useContext(MobileNavigationContext);
  if (context === undefined) {
    throw new Error('useMobileNavigation must be used within a MobileNavigationProvider');
  }
  return context;
}
