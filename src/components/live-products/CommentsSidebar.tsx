import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CommentsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function CommentsSidebar({ isOpen, onClose, children }: CommentsSidebarProps) {
  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full bg-background border-l shadow-lg z-50",
        "w-[400px] sm:w-[450px] transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Facebook Comments</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="h-[calc(100vh-65px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
