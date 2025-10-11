import { useFacebookComments } from "@/contexts/FacebookCommentsContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FacebookCommentsManager } from "./FacebookCommentsManager";
import { MessageSquare } from "lucide-react";

export function FacebookCommentsPanel() {
  const { isPanelOpen, closePanel } = useFacebookComments();

  return (
    <Sheet open={isPanelOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-[600px] p-0 flex flex-col h-full"
      >
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Theo dõi Comments Facebook
          </SheetTitle>
          <SheetDescription>
            Xem và tương tác với comments từ video livestream
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <FacebookCommentsManager />
        </div>
      </SheetContent>
    </Sheet>
  );
}
