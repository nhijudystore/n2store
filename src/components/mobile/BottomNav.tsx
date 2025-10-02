import { NavLink, useLocation } from 'react-router-dom';
import { ShoppingBag, Package, ShoppingCart, BarChart3, MoreHorizontal } from 'lucide-react';
import { useMobileNavigation } from '@/contexts/MobileNavigationContext';
import { cn } from '@/lib/utils';

const bottomNavItems = [
  {
    title: 'Đặt hàng',
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
    title: 'Báo Cáo',
    url: '/livestream-reports',
    icon: BarChart3,
  },
];

export function BottomNav() {
  const location = useLocation();
  const { setIsDrawerOpen } = useMobileNavigation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border md:hidden">
      <div className="grid grid-cols-5 h-16">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className={cn(
              'flex flex-col items-center justify-center gap-1 transition-colors',
              isActive(item.url)
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{item.title}</span>
          </NavLink>
        ))}
        
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors active:text-primary"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-xs font-medium">Thêm</span>
        </button>
      </div>
    </nav>
  );
}
