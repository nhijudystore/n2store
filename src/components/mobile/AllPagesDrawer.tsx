import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { X, Check, ShoppingBag, Package, ShoppingCart, BarChart3, Settings, LogOut } from 'lucide-react';
import { useMobileNavigation } from '@/contexts/MobileNavigationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const allPages = [
  {
    category: 'Chức năng chính',
    items: [
      {
        title: 'Đặt hàng NCC',
        url: '/purchase-orders',
        icon: ShoppingBag,
      },
      {
        title: 'Kiểm hàng',
        url: '/goods-receiving',
        icon: Package,
      },
      {
        title: 'Order Live',
        url: '/live-products',
        icon: ShoppingCart,
      },
      {
        title: 'Báo Cáo Livestream',
        url: '/livestream-reports',
        icon: BarChart3,
      },
    ],
  },
  {
    category: 'Quản trị',
    items: [
      {
        title: 'Cài đặt',
        url: '/settings',
        icon: Settings,
      },
    ],
  },
];

export function AllPagesDrawer() {
  const { isDrawerOpen, setIsDrawerOpen } = useMobileNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
    setIsDrawerOpen(false);
    navigate('/auth');
  };

  return (
    <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl p-0">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Tất Cả Trang</SheetTitle>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="rounded-full p-1 hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </SheetHeader>

        <div className="overflow-y-auto h-[calc(70vh-140px)] px-6 py-4">
          {allPages.map((section, index) => (
            <div key={section.category} className={index > 0 ? 'mt-6' : ''}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={() => setIsDrawerOpen(false)}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-lg transition-colors',
                      isActive(item.url)
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    {isActive(item.url) && <Check className="w-5 h-5" />}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 inset-x-0 p-4 border-t border-border bg-background">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                navigate('/settings');
                setIsDrawerOpen(false);
              }}
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              Cài đặt
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Đăng Xuất
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
