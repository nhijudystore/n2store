import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileText, DollarSign, TrendingUp, Clock } from "lucide-react";

export function PurchaseOrderStats() {
  const { data: stats } = useQuery({
    queryKey: ["purchase-order-stats"],
    queryFn: async () => {
      const [ordersResult, totalAmountResult, todayOrdersResult] = await Promise.all([
        supabase.from("purchase_orders").select("*", { count: "exact" }),
        supabase.from("purchase_orders").select("final_amount"),
        supabase
          .from("purchase_orders")
          .select("*", { count: "exact" })
          .eq("order_date", new Date().toISOString().split("T")[0])
      ]);

      const totalOrders = ordersResult.count || 0;
      const totalAmount = totalAmountResult.data?.reduce((sum, order) => sum + Number(order.final_amount || 0), 0) || 0;
      const todayOrders = todayOrdersResult.count || 0;

      return {
        totalOrders,
        totalAmount,
        todayOrders,
        avgOrderValue: totalOrders > 0 ? totalAmount / totalOrders : 0
      };
    }
  });

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
          <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tổng giá trị</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats?.totalAmount || 0)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Đơn hôm nay</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.todayOrders || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Giá trị TB</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats?.avgOrderValue || 0)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}