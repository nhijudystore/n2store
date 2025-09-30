import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, DollarSign, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";

interface PurchaseOrderItem {
  product_name: string;
  product_code: string | null;
  variant: string | null;
  quantity: number;
  unit_price: number;
  selling_price: number;
  product_images: string[] | null;
  price_images: string[] | null;
}

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  total_amount: number;
  final_amount: number;
  discount_amount: number;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_id?: string | null;
  notes: string | null;
  invoice_date: string | null;
  invoice_images: string[] | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
}

interface PurchaseOrderStatsProps {
  filteredOrders: PurchaseOrder[];
  isLoading: boolean;
}

export function PurchaseOrderStats({ filteredOrders, isLoading }: PurchaseOrderStatsProps) {
  // Calculate stats from filteredOrders prop instead of fetching independently
  const totalOrders = filteredOrders.length;
  const totalAmount = filteredOrders.reduce((sum, order) => sum + Number(order.final_amount || 0), 0);
  const todayOrders = filteredOrders.filter(order => 
    format(new Date(order.order_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ).length;
  const avgOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(amount);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tổng đơn hàng</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : totalOrders}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tổng giá trị</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "..." : formatCurrency(totalAmount)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Đơn hôm nay</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : todayOrders}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Giá trị TB</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "..." : formatCurrency(avgOrderValue)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}