import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Eye, Search, Filter, Calendar, Trash2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { PurchaseOrderDetailDialog } from "./PurchaseOrderDetailDialog";
import { useToast } from "@/hooks/use-toast";

interface PurchaseOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  product_images: string[] | null;
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
  notes: string | null;
  invoice_date: string | null;
  created_at: string;
  updated_at: string;
  items: PurchaseOrderItem[];
}

export function PurchaseOrderList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deletePurchaseOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // First delete all purchase order items
      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("purchase_order_id", orderId);

      if (itemsError) throw itemsError;

      // Then delete the purchase order
      const { error: orderError } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", orderId);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({
        title: "Thành công",
        description: "Đơn hàng đã được xóa thành công",
      });
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa đơn hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
      console.error("Error deleting purchase order:", error);
    }
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      // Get all purchase orders first
      const { data: ordersData, error: ordersError } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Get items for each order
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          const { data: items } = await supabase
            .from("purchase_order_items")
            .select("product_name, quantity, unit_price, product_images")
            .eq("purchase_order_id", order.id);

          return {
            ...order,
            items: items || []
          };
        })
      );

      return ordersWithItems as PurchaseOrder[];
    }
  });

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = 
      order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items?.some(item => item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Flatten items for rowSpan structure
  const flattenedItems = filteredOrders?.flatMap(order => {
    if (!order.items || order.items.length === 0) {
      return [{
        ...order,
        item: null,
        itemCount: 1,
        isFirstItem: true
      }];
    }
    return order.items.map((item, index) => ({
      ...order,
      item,
      itemCount: order.items.length,
      isFirstItem: index === 0
    }));
  }) || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      confirmed: "secondary", 
      received: "default",
      completed: "default",
      cancelled: "destructive"
    };

    const labels = {
      pending: "Đang chờ",
      confirmed: "Đã xác nhận", 
      received: "Đã nhận hàng",
      completed: "Hoàn thành",
      cancelled: "Đã hủy"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(amount);
  };

  const handleViewDetails = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsDetailDialogOpen(true);
  };

  const handleDeleteOrder = (order: PurchaseOrder) => {
    setOrderToDelete(order);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      deletePurchaseOrderMutation.mutate(orderToDelete.id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm đơn hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Lọc theo trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="pending">Đang chờ</SelectItem>
            <SelectItem value="confirmed">Đã xác nhận</SelectItem>
            <SelectItem value="received">Đã nhận hàng</SelectItem>
            <SelectItem value="completed">Hoàn thành</SelectItem>
            <SelectItem value="cancelled">Đã hủy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead>Ngày đặt</TableHead>
              <TableHead className="w-20">Hình ảnh</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Giá</TableHead>
              <TableHead>Tổng tiền</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flattenedItems?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Không có đơn hàng nào
                </TableCell>
              </TableRow>
            ) : (
              flattenedItems?.map((flatItem, index) => (
                <TableRow key={`${flatItem.id}-${index}`} className="border-b">
                  {/* Order-level columns with rowSpan - only show on first item */}
                  {flatItem.isFirstItem && (
                    <>
                      <TableCell 
                        className="font-medium border-r" 
                        rowSpan={flatItem.itemCount}
                      >
                        {flatItem.supplier_name || "Chưa cập nhật"}
                      </TableCell>
                      <TableCell 
                        className="border-r" 
                        rowSpan={flatItem.itemCount}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(flatItem.order_date), "dd/MM/yyyy", { locale: vi })}
                        </div>
                      </TableCell>
                    </>
                  )}
                  
                  {/* Product-level columns - show for each item */}
                  <TableCell className="w-20">
                    {flatItem.item ? (
                      flatItem.item.product_images && flatItem.item.product_images.length > 0 ? (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <div className="relative cursor-pointer">
                              <img
                                src={flatItem.item.product_images[0]}
                                alt={flatItem.item.product_name}
                                className="w-12 h-12 object-cover rounded border hover:opacity-80 transition-opacity"
                                onClick={() => window.open(flatItem.item.product_images![0], '_blank')}
                              />
                              {flatItem.item.product_images.length > 1 && (
                                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                  {flatItem.item.product_images.length}
                                </span>
                              )}
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80 p-2" side="right">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">{flatItem.item.product_name}</div>
                              <div className="aspect-square w-full bg-muted rounded-md overflow-hidden">
                                <img
                                  src={flatItem.item.product_images[0]}
                                  alt={flatItem.item.product_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {flatItem.item.product_images.length > 1 && (
                                <div className="text-xs text-muted-foreground text-center">
                                  +{flatItem.item.product_images.length - 1} ảnh khác
                                </div>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">N/A</span>
                        </div>
                      )
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">N/A</span>
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell className="max-w-xs">
                    {flatItem.item ? (
                      <div className="text-sm">{flatItem.item.product_name}</div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Chưa có sản phẩm</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {flatItem.item ? (
                      <div className="text-sm">{flatItem.item.quantity}</div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {flatItem.item ? (
                      <div className="text-sm">{formatCurrency(flatItem.item.unit_price || 0)}</div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  
                  {/* Order-level columns with rowSpan - only show on first item */}
                  {flatItem.isFirstItem && (
                    <>
                      <TableCell 
                        className="font-medium border-l" 
                        rowSpan={flatItem.itemCount}
                      >
                        {formatCurrency(flatItem.final_amount || 0)}
                      </TableCell>
                      <TableCell 
                        className="border-l" 
                        rowSpan={flatItem.itemCount}
                      >
                        {getStatusBadge(flatItem.status)}
                      </TableCell>
                      <TableCell 
                        className="border-l" 
                        rowSpan={flatItem.itemCount}
                      >
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewDetails(flatItem)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteOrder(flatItem)}
                            disabled={flatItem.status !== 'pending' || deletePurchaseOrderMutation.isPending}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PurchaseOrderDetailDialog 
        order={selectedOrder}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa đơn hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa đơn hàng này không? Hành động này không thể hoàn tác.
              {orderToDelete && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>Nhà cung cấp:</strong> {orderToDelete.supplier_name || "Chưa cập nhật"}<br/>
                  <strong>Ngày đặt:</strong> {format(new Date(orderToDelete.order_date), "dd/MM/yyyy", { locale: vi })}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deletePurchaseOrderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePurchaseOrderMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}