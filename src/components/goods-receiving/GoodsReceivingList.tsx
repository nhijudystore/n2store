import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, Package, CheckCircle } from "lucide-react";
import { CreateReceivingDialog } from "./CreateReceivingDialog";

type StatusFilter = "needInspection" | "inspected" | "all";

export function GoodsReceivingList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("needInspection");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

      // Get receiving records for each order
      const ordersWithStatus = await Promise.all(
        (purchaseOrders || []).map(async (order) => {
          const { data: receiving } = await supabase
            .from('goods_receiving')
            .select('*')
            .eq('purchase_order_id', order.id)
            .maybeSingle();
          
          return { 
            ...order, 
            receiving,
            hasReceiving: !!receiving 
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

  // Apply quick filters
  const applyQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    const today = new Date();
    
    switch (filter) {
      case "today":
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
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
      default:
        setStartDate("");
        setEndDate("");
    }
  };

  // Filter by search query
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
  });

  const handleInspectClick = (order: any) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danh sách đơn hàng</CardTitle>
        
        {/* Filters */}
        <div className="space-y-4 pt-4">
          {/* Row 1: Date filters and quick filter */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
                placeholder="Từ ngày"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
                placeholder="Đến ngày"
              />
            </div>
            
            <Select value={quickFilter} onValueChange={applyQuickFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Lọc nhanh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="today">Hôm nay</SelectItem>
                <SelectItem value="week">7 ngày qua</SelectItem>
                <SelectItem value="month">30 ngày qua</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Search and status filter */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm nhà cung cấp, sản phẩm, ngày..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needInspection">Cần kiểm</SelectItem>
                <SelectItem value="inspected">Đã kiểm</SelectItem>
                <SelectItem value="all">Toàn bộ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
        ) : filteredOrders && filteredOrders.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày đặt</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Số hóa đơn</TableHead>
                  <TableHead>Tổng SP</TableHead>
                  <TableHead>Tổng SL</TableHead>
                  <TableHead>Tổng tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order: any) => {
                  const totalItems = order.items?.length || 0;
                  const totalQuantity = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
                  
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: vi })}
                      </TableCell>
                      <TableCell className="font-medium">{order.supplier_name}</TableCell>
                      <TableCell>{order.invoice_number || '-'}</TableCell>
                      <TableCell>{totalItems}</TableCell>
                      <TableCell>{totalQuantity}</TableCell>
                      <TableCell>{order.final_amount?.toLocaleString('vi-VN')}đ</TableCell>
                      <TableCell>
                        {order.hasReceiving ? (
                          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Đã kiểm
                          </Badge>
                        ) : (order.status === 'confirmed' || order.status === 'pending') ? (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Package className="w-3 h-3 mr-1" />
                            Cần kiểm
                          </Badge>
                        ) : (
                          <Badge variant="outline">{order.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!order.hasReceiving && (order.status === 'confirmed' || order.status === 'pending') && (
                          <Button 
                            size="sm" 
                            onClick={() => handleInspectClick(order)}
                          >
                            Kiểm hàng
                          </Button>
                        )}
                        {order.hasReceiving && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleInspectClick(order)}
                          >
                            Xem chi tiết
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Không tìm thấy đơn hàng nào
          </div>
        )}
      </CardContent>

      <CreateReceivingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
        onSuccess={() => {
          refetch();
          setDialogOpen(false);
        }}
      />
    </Card>
  );
}
