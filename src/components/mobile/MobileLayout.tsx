import { ReactNode } from 'react';
import { Search, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BottomNav } from './BottomNav';
import { AllPagesDrawer } from './AllPagesDrawer';

interface MobileLayoutProps {
  children: ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const { user, signOut } = useAuth();

  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (email: string | undefined) => {
    if (!email) return 'User';
    return email.split('@')[0];
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex h-16 items-center gap-4 px-4">
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Tìm kiếm..."
              className="h-9 border-none bg-muted focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm">
                    {getInitials(user?.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{getDisplayName(user?.email)}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()}>
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* All Pages Drawer */}
      <AllPagesDrawer />
    </div>
  );
}
