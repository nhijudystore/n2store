import { Package, DollarSign, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatVND } from "@/lib/currency-utils";

interface Product {
  stock_quantity: number;
  selling_price: number;
  purchase_price: number;
}

interface ProductStatsProps {
  products: Product[];
}

export function ProductStats({ products }: ProductStatsProps) {
  const totalProducts = products.length;
  
  const totalInventoryValue = products.reduce(
    (sum, p) => sum + (p.stock_quantity * (p.purchase_price || 0)),
    0
  );
  
  const outOfStockCount = products.filter(p => p.stock_quantity <= 0).length;
  const negativeStockCount = products.filter(p => p.stock_quantity < 0).length;

  const stats = [
    {
      title: "Tổng sản phẩm",
      value: totalProducts.toLocaleString("vi-VN"),
      icon: Package,
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-500",
    },
    {
      title: "Giá trị tồn kho",
      value: formatVND(totalInventoryValue),
      icon: DollarSign,
      bgColor: "bg-green-500/10",
      iconColor: "text-green-500",
    },
    {
      title: "Hết hàng",
      value: outOfStockCount.toLocaleString("vi-VN"),
      icon: AlertTriangle,
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-500",
    },
    {
      title: "Tồn âm (cần check)",
      value: negativeStockCount.toLocaleString("vi-VN"),
      icon: AlertTriangle,
      bgColor: "bg-red-500/10",
      iconColor: "text-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`${stat.bgColor} p-3 rounded-lg`}>
              <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
