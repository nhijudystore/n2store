import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLiveSessionDialog } from "@/components/live-products/CreateLiveSessionDialog";
import { AddProductToLiveDialog } from "@/components/live-products/AddProductToLiveDialog";
import { AddOrderDialog } from "@/components/live-products/AddOrderDialog";
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
  customer_code: string;
  quantity: number;
  order_date: string;
}

export default function LiveProducts() {
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  
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

  const toggleSessionExpansion = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

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
        "Chi tiết đơn hàng": productOrders.map(o => `${o.order_code} (${o.customer_code}: ${o.quantity})`).join("; ")
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
                <div className="space-y-4">
                  {liveProducts.map((product) => {
                    const productOrders = liveOrders.filter(order => order.live_product_id === product.id);
                    const isExpanded = expandedSessions.has(product.id);
                    
                    return (
                      <div key={product.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSessionExpansion(product.id)}
                              className="p-1"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </Button>
                            <div>
                              <div className="font-medium">{product.product_name}</div>
                              <div className="text-sm text-muted-foreground">Mã: {product.product_code}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">SL chuẩn bị</div>
                              <div className="font-medium">{product.prepared_quantity}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">SL đã bán</div>
                              <div className="font-medium text-primary">{product.sold_quantity}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Đơn hàng</div>
                              <div className="font-medium">{productOrders.length}</div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedProductId(product.id);
                                setIsAddOrderOpen(true);
                              }}
                              className="gap-2"
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Thêm đơn
                            </Button>
                          </div>
                        </div>

                        {isExpanded && productOrders.length > 0 && (
                          <div className="mt-4 pl-8 space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">Đơn hàng:</div>
                            {productOrders.map((order) => (
                              <div key={order.id} className="flex items-center justify-between bg-muted/50 rounded p-3">
                                <div className="flex items-center gap-4">
                                  <Badge variant="outline">{order.order_code}</Badge>
                                  <span className="text-sm">KH: {order.customer_code}</span>
                                  <span className="text-sm">SL: {order.quantity}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {format(new Date(order.order_date), "dd/MM/yyyy HH:mm", { locale: vi })}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
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

      <AddOrderDialog
        open={isAddOrderOpen}
        onOpenChange={setIsAddOrderOpen}
        sessionId={selectedSession}
        productId={selectedProductId}
      />
    </div>
  );
}