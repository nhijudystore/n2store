import React, { createContext, useContext, useState } from "react";

interface FacebookCommentsContextType {
  isPanelOpen: boolean;
  openPanel: (videoId?: string) => void;
  closePanel: () => void;
  selectedVideoId: string | null;
}

const FacebookCommentsContext = createContext<FacebookCommentsContextType | undefined>(undefined);

export function FacebookCommentsProvider({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const openPanel = (videoId?: string) => {
    setIsPanelOpen(true);
    if (videoId) {
      setSelectedVideoId(videoId);
    }
  };

  const closePanel = () => {
    setIsPanelOpen(false);
  };

  return (
    <FacebookCommentsContext.Provider
      value={{
        isPanelOpen,
        openPanel,
        closePanel,
        selectedVideoId,
      }}
    >
      {children}
    </FacebookCommentsContext.Provider>
  );
}

export function useFacebookComments() {
  const context = useContext(FacebookCommentsContext);
  if (context === undefined) {
    throw new Error("useFacebookComments must be used within a FacebookCommentsProvider");
  }
  return context;
}
