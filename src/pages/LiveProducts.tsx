import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLiveSessionDialog } from "@/components/live-products/CreateLiveSessionDialog";
import { AddProductToLiveDialog } from "@/components/live-products/AddProductToLiveDialog";
import { QuickAddOrder } from "@/components/live-products/QuickAddOrder";
import { LiveSessionStats } from "@/components/live-products/LiveSessionStats";
import { 
  Plus, 
  Download, 
  Calendar,
  Package,
  ShoppingCart,
  Trash2,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface LiveSession {
  id: string;
  session_date: string;
  supplier_name: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface LiveProduct {
  id: string;
  live_session_id: string;
  product_code: string;
  product_name: string;
  prepared_quantity: number;
  sold_quantity: number;
}

interface LiveOrder {
  id: string;
  live_session_id: string;
  live_product_id: string;
  order_code: string;
  quantity: number;
  order_date: string;
}

export default function LiveProducts() {
  const [selectedSession, setSelectedSession] = useState<string>("");
  // Removed expandedSessions state as we no longer need expand/collapse
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch live sessions
  const { data: liveSessions = [], isLoading } = useQuery({
    queryKey: ["live-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .order("session_date", { ascending: false });
      
      if (error) throw error;
      return data as LiveSession[];
    },
  });

  // Fetch live products for selected session
  const { data: liveProducts = [] } = useQuery({
    queryKey: ["live-products", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      
      const { data, error } = await supabase
        .from("live_products")
        .select("*")
        .eq("live_session_id", selectedSession)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as LiveProduct[];
    },
    enabled: !!selectedSession,
  });

  // Fetch live orders for selected session
  const { data: liveOrders = [] } = useQuery({
    queryKey: ["live-orders", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      
      const { data, error } = await supabase
        .from("live_orders")
        .select("*")
        .eq("live_session_id", selectedSession)
        .order("order_date", { ascending: false });
      
      if (error) throw error;
      return data as LiveOrder[];
    },
    enabled: !!selectedSession,
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("live_orders")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders"] });
      queryClient.invalidateQueries({ queryKey: ["live-products"] });
      toast.success("Đã xóa đơn hàng thành công");
    },
    onError: (error) => {
      console.error("Error deleting order:", error);
      toast.error("Có lỗi xảy ra khi xóa đơn hàng");
    },
  });

  const handleDeleteOrder = (orderId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa đơn hàng này?")) {
      deleteOrderMutation.mutate(orderId);
    }
  };

  // Removed toggleSessionExpansion function as we no longer need expand/collapse

  const exportToCSV = () => {
    if (!selectedSession) {
      toast.error("Vui lòng chọn một đợt live để xuất dữ liệu");
      return;
    }

    const session = liveSessions.find(s => s.id === selectedSession);
    if (!session) return;

    const csvData = liveProducts.map(product => {
      const productOrders = liveOrders.filter(order => order.live_product_id === product.id);
      return {
        "Mã sản phẩm": product.product_code,
        "Tên sản phẩm": product.product_name,
        "SL chuẩn bị": product.prepared_quantity,
        "SL đã bán": product.sold_quantity,
        "Số đơn hàng": productOrders.length,
        "Chi tiết đơn hàng": productOrders.map(o => `${o.order_code}: ${o.quantity}`).join("; ")
      };
    });

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => headers.map(header => `"${row[header] || ""}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `live-session-${format(new Date(session.session_date), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (isLoading) {
    return <div className="p-6">Đang tải...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản Lý Sản Phẩm Live</h1>
          <p className="text-muted-foreground">Quản lý các đợt livestream và đơn hàng</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsCreateSessionOpen(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Tạo đợt live mới
          </Button>
          {selectedSession && (
            <>
              <Button 
                variant="outline"
                onClick={() => setIsAddProductOpen(true)}
                className="gap-2"
              >
                <Package className="w-4 h-4" />
                Thêm sản phẩm
              </Button>
              <Button 
                variant="outline"
                onClick={exportToCSV}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Xuất CSV
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={selectedSession} onValueChange={setSelectedSession}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {liveSessions.map((session) => (
            <TabsTrigger key={session.id} value={session.id} className="gap-2">
              <Calendar className="w-4 h-4" />
              {format(new Date(session.session_date), "dd/MM/yyyy", { locale: vi })} - {session.supplier_name}
            </TabsTrigger>
          ))}
        </TabsList>

        {liveSessions.map((session) => (
          <TabsContent key={session.id} value={session.id} className="space-y-4">
            <LiveSessionStats 
              sessionId={session.id}
              products={liveProducts}
              orders={liveOrders}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Danh sách sản phẩm
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {liveProducts.map((product) => {
                    const productOrders = liveOrders.filter(order => order.live_product_id === product.id);
                    
                    return (
                      <div key={product.id} className="border rounded-lg p-4">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* Product Info */}
                          <div className="col-span-12 md:col-span-3">
                            <div className="font-medium">{product.product_name}</div>
                            <div className="text-sm text-muted-foreground">Mã: {product.product_code}</div>
                          </div>
                          
                          {/* Prepared Quantity */}
                          <div className="col-span-3 md:col-span-1 text-center">
                            <div className="text-sm text-muted-foreground">SL chuẩn bị</div>
                            <div className="font-medium">{product.prepared_quantity}</div>
                          </div>
                          
                          {/* Sold Quantity */}
                          <div className="col-span-3 md:col-span-1 text-center">
                            <div className="text-sm text-muted-foreground">SL đã bán</div>
                            <div className="font-medium text-primary">{product.sold_quantity}</div>
                          </div>
                          
                          {/* Order Count */}
                          <div className="col-span-3 md:col-span-1 text-center">
                            <div className="text-sm text-muted-foreground">Số đơn</div>
                            <div className="font-medium">{productOrders.length}</div>
                          </div>
                          
                          {/* Order Codes */}
                          <div className="col-span-12 md:col-span-3">
                            <div className="text-sm text-muted-foreground mb-1">Mã đơn hàng:</div>
                            <div className="flex flex-wrap gap-1">
                              {productOrders.length > 0 ? productOrders.map((order) => (
                                <div
                                  key={order.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-mono"
                                >
                                  <span>{order.order_code}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="h-3 w-3 p-0 hover:bg-destructive/20"
                                  >
                                    <Trash2 className="h-2 w-2" />
                                  </Button>
                                </div>
                              )) : (
                                <span className="text-xs text-muted-foreground">Chưa có đơn</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Quick Add Order */}
                          <div className="col-span-12 md:col-span-3">
                            <QuickAddOrder sessionId={selectedSession} productId={product.id} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {liveProducts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Chưa có sản phẩm nào trong đợt live này
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {liveSessions.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Chưa có đợt live nào</h3>
            <p className="text-muted-foreground mb-4">Tạo đợt live đầu tiên để bắt đầu quản lý sản phẩm</p>
            <Button onClick={() => setIsCreateSessionOpen(true)}>
              Tạo đợt live mới
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateLiveSessionDialog
        open={isCreateSessionOpen}
        onOpenChange={setIsCreateSessionOpen}
      />

      <AddProductToLiveDialog
        open={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
        sessionId={selectedSession}
      />

    </div>
  );
}