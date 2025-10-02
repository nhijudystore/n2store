import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Bell } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  activeTab?: string;
  onBack?: () => void;
}

export function MobileLayout({
  children,
  title,
  showBack = false,
  activeTab,
  onBack,
}: MobileLayoutProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const getInitials = (email: string | undefined) => {
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: Back button or Logo */}
          <div className="flex items-center gap-2">
            {showBack ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : (
              <div className="font-semibold text-lg">
                {title || "Kiểm hàng"}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Search className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">
                      {getInitials(user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Tài khoản</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content with bottom padding for nav */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} />
    </div>
  );
}
