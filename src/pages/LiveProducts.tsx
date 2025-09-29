import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateLiveSessionDialog } from "@/components/live-products/CreateLiveSessionDialog";
import { EditLiveSessionDialog } from "@/components/live-products/EditLiveSessionDialog";
import { AddProductToLiveDialog } from "@/components/live-products/AddProductToLiveDialog";
import { EditProductDialog } from "@/components/live-products/EditProductDialog";
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
  ChevronRight,
  Edit,
  ListOrdered
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface LiveSession {
  id: string;
  session_date: string;
  supplier_name: string;
  session_name?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface LivePhase {
  id: string;
  live_session_id: string;
  phase_date: string;
  phase_type: string;
  status: string;
  created_at: string;
}

interface LiveProduct {
  id: string;
  live_session_id: string;
  live_phase_id?: string;
  product_code: string;
  product_name: string;
  prepared_quantity: number;
  sold_quantity: number;
}

interface LiveOrder {
  id: string;
  live_session_id: string;
  live_product_id: string;
  live_phase_id?: string;
  order_code: string;
  quantity: number;
  order_date: string;
}

interface OrderWithProduct extends LiveOrder {
  product_code: string;
  product_name: string;
  product_images?: string[];
}

export default function LiveProducts() {
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("products");
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    product_code: string;
    product_name: string;
    prepared_quantity: number;
  } | null>(null);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  
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

  // Fetch live phases for selected session
  const { data: livePhases = [] } = useQuery({
    queryKey: ["live-phases", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      
      const { data, error } = await supabase
        .from("live_phases")
        .select("*")
        .eq("live_session_id", selectedSession)
        .order("phase_date", { ascending: true })
        .order("phase_type", { ascending: true });
      
      if (error) throw error;
      return data as LivePhase[];
    },
    enabled: !!selectedSession,
  });

  // Fetch live products for selected phase
  const { data: liveProducts = [] } = useQuery({
    queryKey: ["live-products", selectedPhase],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      const { data, error } = await supabase
        .from("live_products")
        .select("*")
        .eq("live_phase_id", selectedPhase)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as LiveProduct[];
    },
    enabled: !!selectedPhase,
  });

  // Fetch live orders for selected phase
  const { data: liveOrders = [] } = useQuery({
    queryKey: ["live-orders", selectedPhase],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      const { data, error } = await supabase
        .from("live_orders")
        .select("*")
        .eq("live_phase_id", selectedPhase)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as LiveOrder[];
    },
    enabled: !!selectedPhase,
  });

  // Fetch orders with product details for selected phase
  const { data: ordersWithProducts = [] } = useQuery({
    queryKey: ["orders-with-products", selectedPhase],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      const { data, error } = await supabase
        .from("live_orders")
        .select(`
          *,
          live_products (
            product_code,
            product_name
          )
        `)
        .eq("live_phase_id", selectedPhase)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data.map(order => ({
        ...order,
        product_code: order.live_products?.product_code || "",
        product_name: order.live_products?.product_name || "",
      })) as OrderWithProduct[];
    },
    enabled: !!selectedPhase,
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const order = liveOrders.find(o => o.id === orderId);
      if (!order) throw new Error("Order not found");

      // Update product sold quantity first
      const product = liveProducts.find(p => p.id === order.live_product_id);
      if (product) {
        const { error: updateError } = await supabase
          .from("live_products")
          .update({ 
            sold_quantity: Math.max(0, product.sold_quantity - order.quantity) 
          })
          .eq("id", order.live_product_id);
        
        if (updateError) throw updateError;
      }

      // Delete the order
      const { error } = await supabase
        .from("live_orders")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase] });
      toast.success("Đã xóa đơn hàng thành công");
    },
    onError: (error) => {
      console.error("Error deleting order:", error);
      toast.error("Có lỗi xảy ra khi xóa đơn hàng");
    },
  });

  // Delete product mutation (cascading delete orders)
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      // First delete all orders for this product
      const { error: deleteOrdersError } = await supabase
        .from("live_orders")
        .delete()
        .eq("live_product_id", productId);
      
      if (deleteOrdersError) throw deleteOrdersError;

      // Then delete the product
      const { error } = await supabase
        .from("live_products")
        .delete()
        .eq("id", productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase] });
      toast.success("Đã xóa sản phẩm và các đơn hàng liên quan thành công");
    },
    onError: (error) => {
      console.error("Error deleting product:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    },
  });

  // Delete all phases and data for a live session
  const deleteAllPhasesForSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // First get all phases for this session
      const { data: phases, error: phasesError } = await supabase
        .from("live_phases")
        .select("id")
        .eq("live_session_id", sessionId);
      
      if (phasesError) throw phasesError;

      const phaseIds = phases.map(p => p.id);

      // Delete all orders for all phases in this session
      if (phaseIds.length > 0) {
        const { error: deleteOrdersError } = await supabase
          .from("live_orders")
          .delete()
          .in("live_phase_id", phaseIds);
        
        if (deleteOrdersError) throw deleteOrdersError;

        // Delete all products for all phases in this session
        const { error: deleteProductsError } = await supabase
          .from("live_products")
          .delete()
          .in("live_phase_id", phaseIds);
        
        if (deleteProductsError) throw deleteProductsError;
      }

      // Delete all phases for this session
      const { error: deletePhasesError } = await supabase
        .from("live_phases")
        .delete()
        .eq("live_session_id", sessionId);
      
      if (deletePhasesError) throw deletePhasesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-phases"] });
      queryClient.invalidateQueries({ queryKey: ["live-products"] });
      queryClient.invalidateQueries({ queryKey: ["live-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products"] });
      setSelectedPhase("");
      toast.success("Đã xóa toàn bộ phiên live và dữ liệu thành công");
    },
    onError: (error) => {
      console.error("Error deleting all phases for session:", error);
      toast.error("Có lỗi xảy ra khi xóa phiên live");
    },
  });

  // Delete live session mutation (cascading delete products and orders)
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // First get all phases for this session
      const { data: phases, error: phasesError } = await supabase
        .from("live_phases")
        .select("id")
        .eq("live_session_id", sessionId);
      
      if (phasesError) throw phasesError;

      const phaseIds = phases.map(p => p.id);

      // Delete all orders for all phases in this session
      if (phaseIds.length > 0) {
        const { error: deleteOrdersError } = await supabase
          .from("live_orders")
          .delete()
          .in("live_phase_id", phaseIds);
        
        if (deleteOrdersError) throw deleteOrdersError;

        // Delete all products for all phases in this session
        const { error: deleteProductsError } = await supabase
          .from("live_products")
          .delete()
          .in("live_phase_id", phaseIds);
        
        if (deleteProductsError) throw deleteProductsError;
      }

      // Delete all phases for this session
      const { error: deletePhasesError } = await supabase
        .from("live_phases")
        .delete()
        .eq("live_session_id", sessionId);
      
      if (deletePhasesError) throw deletePhasesError;

      // Finally delete the session
      const { error } = await supabase
        .from("live_sessions")
        .delete()
        .eq("id", sessionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["live-phases"] });
      queryClient.invalidateQueries({ queryKey: ["live-products"] });
      queryClient.invalidateQueries({ queryKey: ["live-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products"] });
      setSelectedSession("");
      setSelectedPhase("");
      toast.success("Đã xóa đợt live và tất cả dữ liệu liên quan thành công");
    },
    onError: (error) => {
      console.error("Error deleting live session:", error);
      toast.error("Có lỗi xảy ra khi xóa đợt live");
    },
  });

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa đơn hàng này?")) {
      await deleteOrderMutation.mutateAsync(orderId);
    }
  };

  const handleDeleteAllPhasesForSession = async (sessionId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ phiên live và dữ liệu của đợt này? Hành động này không thể hoàn tác.")) {
      await deleteAllPhasesForSessionMutation.mutateAsync(sessionId);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này? Tất cả đơn hàng liên quan cũng sẽ bị xóa.")) {
      await deleteProductMutation.mutateAsync(productId);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa đợt live này? Tất cả phiên live, sản phẩm và đơn hàng liên quan sẽ bị xóa.")) {
      await deleteSessionMutation.mutateAsync(sessionId);
    }
  };

  const handleEditProduct = (product: LiveProduct) => {
    setEditingProduct({
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      prepared_quantity: product.prepared_quantity,
    });
    setIsEditProductOpen(true);
  };

  const handleEditSession = (session: LiveSession) => {
    setEditingSession(session);
    setIsEditSessionOpen(true);
  };

  const exportToCSV = () => {
    if (!selectedPhase || liveProducts.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const selectedPhaseData = livePhases.find(p => p.id === selectedPhase);
    if (!selectedPhaseData) return;

    const csvData = liveProducts.map(product => ({
      "Mã sản phẩm": product.product_code,
      "Tên sản phẩm": product.product_name,
      "Số lượng chuẩn bị": product.prepared_quantity,
      "Số lượng đã bán": product.sold_quantity,
      "Còn lại": product.prepared_quantity - product.sold_quantity,
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map(row => Object.values(row).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `danh-sach-san-pham-${format(new Date(selectedPhaseData.phase_date), "dd-MM-yyyy")}-${selectedPhaseData.phase_type}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPhaseDisplayName = (phase: LivePhase) => {
    const date = new Date(phase.phase_date);
    const dayNumber = Math.floor((date.getTime() - new Date(livePhases[0]?.phase_date || phase.phase_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const phaseType = phase.phase_type === 'morning' ? 'Sáng' : 'Chiều';
    return `Ngày ${dayNumber} - ${phaseType} (${format(date, "dd/MM/yyyy")})`;
  };

  const getSessionDisplayName = (session: LiveSession) => {
    const sessionName = session.session_name || session.supplier_name;
    if (session.start_date && session.end_date) {
      return `${sessionName} - ${format(new Date(session.start_date), "dd/MM/yyyy")} đến ${format(new Date(session.end_date), "dd/MM/yyyy")}`;
    }
    return `${sessionName} - ${format(new Date(session.session_date), "dd/MM/yyyy")}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Products</h1>
          <p className="text-muted-foreground">
            Quản lý các phiên live, sản phẩm và đơn hàng
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsCreateSessionOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Tạo đợt Live mới
          </Button>
        </div>
      </div>

      {/* Session Selection */}
      {liveSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Chọn đợt Live
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Đợt Live</label>
                <Select 
                  value={selectedSession} 
                  onValueChange={(value) => {
                    setSelectedSession(value);
                    setSelectedPhase(""); // Reset phase selection
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn một đợt live" />
                  </SelectTrigger>
                  <SelectContent>
                    {liveSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {getSessionDisplayName(session)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSession && livePhases.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Phiên Live</label>
                  <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn phiên live" />
                    </SelectTrigger>
                    <SelectContent>
                      {livePhases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          {getPhaseDisplayName(phase)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedSession && (
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const session = liveSessions.find(s => s.id === selectedSession);
                    if (session) handleEditSession(session);
                  }}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Chỉnh sửa đợt live
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteAllPhasesForSession(selectedSession)}
                  className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa toàn bộ phiên live
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteSession(selectedSession)}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa đợt live
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats and Content */}
      {selectedPhase && (
        <>
          <LiveSessionStats 
            sessionId={selectedSession}
            phaseId={selectedPhase}
            products={liveProducts}
            orders={liveOrders}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Sản phẩm ({liveProducts.length})
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Đơn hàng (theo mã đơn)
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                {activeTab === "products" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddProductOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm sản phẩm
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToCSV}
                      disabled={liveProducts.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Xuất CSV
                    </Button>
                  </>
                )}
              </div>
            </div>

            <TabsContent value="products" className="space-y-4">
              {liveProducts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có sản phẩm nào</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Thêm sản phẩm đầu tiên cho phiên live này
                    </p>
                    <Button onClick={() => setIsAddProductOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm sản phẩm
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã SP</TableHead>
                        <TableHead>Tên sản phẩm</TableHead>
                        <TableHead className="text-center">SL chuẩn bị</TableHead>
                        <TableHead className="text-center">SL đã bán</TableHead>
                        <TableHead className="text-center">Số đơn</TableHead>
                        <TableHead>Mã đơn hàng</TableHead>
                        <TableHead className="text-center">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liveProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.product_code}</TableCell>
                          <TableCell>{product.product_name}</TableCell>
                          <TableCell className="text-center">{product.prepared_quantity}</TableCell>
                          <TableCell className="text-center">{product.sold_quantity}</TableCell>
                          <TableCell className="text-center">
                            {ordersWithProducts.filter(order => order.live_product_id === product.id).length}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              {(() => {
                                const productOrders = ordersWithProducts.filter(order => order.live_product_id === product.id);
                                
                                return (
                                  <>
                                    {productOrders.map(order => (
                                      <Badge 
                                        key={order.id} 
                                        variant="secondary" 
                                        className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
                                      >
                                        {order.order_code}
                                      </Badge>
                                    ))}
                                    <div className="flex items-center gap-2 ml-2">
                                      <QuickAddOrder 
                                        productId={product.id}
                                        phaseId={selectedPhase}
                                        sessionId={selectedSession}
                                        availableQuantity={product.prepared_quantity - product.sold_quantity}
                                      />
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditProduct(product)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              {ordersWithProducts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có đơn hàng nào</h3>
                    <p className="text-muted-foreground text-center">
                      Đơn hàng sẽ xuất hiện ở đây khi có người mua sản phẩm
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã đơn hàng</TableHead>
                        <TableHead>Sản phẩm</TableHead>
                        <TableHead className="text-center">Số lượng</TableHead>
                        <TableHead>Ngày đặt</TableHead>
                        <TableHead className="text-center">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Group orders by order_code
                        const orderGroups = ordersWithProducts.reduce((groups, order) => {
                          if (!groups[order.order_code]) {
                            groups[order.order_code] = [];
                          }
                          groups[order.order_code].push(order);
                          return groups;
                        }, {} as Record<string, typeof ordersWithProducts>);

                        return Object.entries(orderGroups).map(([orderCode, orders]) => {
                          const totalQuantity = orders.reduce((sum, order) => sum + order.quantity, 0);
                          const orderDate = orders[0]?.order_date;

                          return (
                            <TableRow key={orderCode}>
                              <TableCell className="font-medium align-top">
                                <Badge variant="default" className="text-sm">
                                  {orderCode}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-2">
                                  {orders.map(order => (
                                    <div key={order.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                      <div className="flex-1">
                                        <div className="font-medium">{order.product_name}</div>
                                        <div className="text-sm text-muted-foreground">{order.product_code}</div>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        x{order.quantity}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-center align-top">
                                <Badge variant="secondary" className="text-sm">
                                  {totalQuantity}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top">
                                {orderDate && format(new Date(orderDate), "dd/MM/yyyy HH:mm", { locale: vi })}
                              </TableCell>
                              <TableCell className="text-center align-top">
                                <div className="flex flex-col gap-1">
                                  {orders.map(order => (
                                    <Button
                                      key={order.id}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteOrder(order.id)}
                                      className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Empty States */}
      {liveSessions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Chưa có đợt live nào</h3>
            <p className="text-muted-foreground text-center mb-4">
              Tạo đợt live đầu tiên để bắt đầu quản lý sản phẩm và đơn hàng
            </p>
            <Button onClick={() => setIsCreateSessionOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo đợt Live mới
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedSession && !selectedPhase && livePhases.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListOrdered className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Đợt live chưa có phiên nào</h3>
            <p className="text-muted-foreground text-center">
              Có vẻ như đợt live này được tạo bằng hệ thống cũ. Vui lòng tạo đợt live mới để sử dụng tính năng mới.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateLiveSessionDialog 
        open={isCreateSessionOpen} 
        onOpenChange={setIsCreateSessionOpen} 
      />
      
      <EditLiveSessionDialog 
        open={isEditSessionOpen}
        onOpenChange={setIsEditSessionOpen}
        session={editingSession}
      />

      <AddProductToLiveDialog 
        open={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
        phaseId={selectedPhase}
        sessionId={selectedSession}
      />

      <EditProductDialog 
        open={isEditProductOpen}
        onOpenChange={setIsEditProductOpen}
        product={editingProduct}
      />
    </div>
  );
}