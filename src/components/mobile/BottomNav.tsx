import { NavLink } from "react-router-dom";
import { Package, BarChart3, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab?: string;
}

export function BottomNav({ activeTab }: BottomNavProps) {
  const navItems = [
    {
      to: "/goods-receiving",
      icon: Package,
      label: "Kiểm hàng",
      id: "goods-receiving",
    },
    {
      to: "/livestream-reports",
      icon: BarChart3,
      label: "Báo cáo LS",
      id: "livestream-reports",
    },
    {
      to: "#",
      icon: Circle,
      label: "Tab 3",
      id: "tab3",
      disabled: true,
    },
    {
      to: "#",
      icon: Circle,
      label: "Tab 4",
      id: "tab4",
      disabled: true,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg md:hidden">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.disabled) {
            return (
              <div
                key={item.id}
                className="flex flex-col items-center justify-center gap-1 text-muted-foreground/30"
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </div>
            );
          }

          return (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive: isNavActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 transition-colors",
                  isNavActive || isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
