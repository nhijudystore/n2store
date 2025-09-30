import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle, AlertTriangle, Boxes } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";

export function GoodsReceivingStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['goods-receiving-stats'],
    queryFn: async () => {
      // Get confirmed purchase orders
      const { data: confirmedOrders } = await supabase
        .from('purchase_orders')
        .select('id, purchase_order_items(quantity)')
        .eq('status', 'confirmed');

      // Get orders with receiving records
      const ordersWithReceiving = await Promise.all(
        (confirmedOrders || []).map(async (order) => {
          const { data: receiving } = await supabase
            .from('goods_receiving')
            .select('id')
            .eq('purchase_order_id', order.id)
            .maybeSingle();
          
          return { ...order, hasReceiving: !!receiving };
        })
      );

      // Total orders needing inspection
      const needInspection = ordersWithReceiving.filter(o => !o.hasReceiving);
      const totalNeedInspection = needInspection.length;

      // Inspected today
      const today = new Date();
      const { data: inspectedToday } = await supabase
        .from('goods_receiving')
        .select('id')
        .gte('receiving_date', startOfDay(today).toISOString())
        .lte('receiving_date', endOfDay(today).toISOString());

      // Orders with discrepancy
      const { data: withDiscrepancy } = await supabase
        .from('goods_receiving')
        .select('id')
        .eq('has_discrepancy', true);

      // Total products needing inspection
      const totalProducts = needInspection.reduce((sum, order) => 
        sum + (order.purchase_order_items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0), 0
      );

      return {
        totalNeedInspection,
        inspectedToday: inspectedToday?.length || 0,
        withDiscrepancy: withDiscrepancy?.length || 0,
        totalProducts
      };
    }
  });

  const statsCards = [
    {
      title: "Tổng đơn cần kiểm",
      value: stats?.totalNeedInspection || 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Đã kiểm hôm nay",
      value: stats?.inspectedToday || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Có chênh lệch",
      value: stats?.withDiscrepancy || 0,
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50"
    },
    {
      title: "Tổng SP cần kiểm",
      value: stats?.totalProducts || 0,
      icon: Boxes,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
