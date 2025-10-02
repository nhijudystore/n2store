import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Package } from "lucide-react";
import { GoodsReceivingStats } from "@/components/goods-receiving/GoodsReceivingStats";
import { GoodsReceivingList } from "@/components/goods-receiving/GoodsReceivingList";

type StatusFilter = "needInspection" | "inspected" | "all";

export default function GoodsReceiving() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("needInspection");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<string>("all");

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['goods-receiving-orders', statusFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          items:purchase_order_items(*)
        `)
        .order('order_date', { ascending: false });

      // Apply date filters
      if (startDate) {
        query = query.gte('order_date', startDate);
      }
      if (endDate) {
        query = query.lte('order_date', endDate);
      }

      const { data: purchaseOrders } = await query;

      // Get receiving records with detailed items for each order
      const ordersWithStatus = await Promise.all(
        (purchaseOrders || []).map(async (order) => {
          const { data: receiving } = await supabase
            .from('goods_receiving')
            .select(`
              *,
              items:goods_receiving_items(
                discrepancy_type,
                discrepancy_quantity
              )
            `)
            .eq('purchase_order_id', order.id)
            .maybeSingle();
          
          // Calculate overall status
          let overallStatus = 'match';
          if (receiving?.items && receiving.items.length > 0) {
            const hasShortage = receiving.items.some((item: any) => item.discrepancy_type === 'shortage');
            const hasOverage = receiving.items.some((item: any) => item.discrepancy_type === 'overage');
            
            if (hasShortage) {
              overallStatus = 'shortage';
            } else if (hasOverage) {
              overallStatus = 'overage';
            }
          }
          
          return { 
            ...order, 
            receiving,
            hasReceiving: !!receiving,
            overallStatus
          };
        })
      );

      // Apply status filter
      if (statusFilter === "needInspection") {
        return ordersWithStatus.filter(o => (o.status === 'confirmed' || o.status === 'pending') && !o.hasReceiving);
      } else if (statusFilter === "inspected") {
        return ordersWithStatus.filter(o => o.hasReceiving);
      }
      
      return ordersWithStatus;
    }
  });

  // Apply search filter
  const filteredOrders = orders?.filter(order => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const matchSupplier = order.supplier_name?.toLowerCase().includes(query);
    const matchProduct = order.items?.some((item: any) => 
      item.product_name?.toLowerCase().includes(query) ||
      item.product_code?.toLowerCase().includes(query)
    );
    const matchDate = format(new Date(order.order_date), 'dd/MM/yyyy').includes(query);
    
    return matchSupplier || matchProduct || matchDate;
  }) || [];

  // Apply quick filters
  const applyQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    const today = new Date();
    
    switch (filter) {
      case "today":
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case "week":
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        setStartDate(format(weekAgo, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case "month":
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        setStartDate(format(monthAgo, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case "thisMonth":
        const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(format(firstDayThisMonth, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case "lastMonth":
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(format(firstDayLastMonth, 'yyyy-MM-dd'));
        setEndDate(format(lastDayLastMonth, 'yyyy-MM-dd'));
        break;
      default:
        setStartDate("");
        setEndDate("");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Kiểm hàng & nhận hàng</h1>
            <p className="text-muted-foreground">Quản lý kiểm tra và nhận hàng từ nhà cung cấp</p>
          </div>
        </div>
      </div>

      <GoodsReceivingStats filteredOrders={filteredOrders} isLoading={isLoading} />
      <GoodsReceivingList 
        filteredOrders={filteredOrders}
        isLoading={isLoading}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickFilter={quickFilter}
        applyQuickFilter={applyQuickFilter}
        refetch={refetch}
      />
    </div>
  );
}
