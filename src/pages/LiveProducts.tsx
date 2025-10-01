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
import { EditOrderItemDialog } from "@/components/live-products/EditOrderItemDialog";
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
  ListOrdered,
  Pencil,
  Copy,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { generateOrderImage } from "@/lib/order-image-generator";
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
  variant?: string | null;
  prepared_quantity: number;
  sold_quantity: number;
  image_url?: string;
  created_at?: string;
}

interface LiveOrder {
  id: string;
  live_session_id: string;
  live_product_id: string;
  live_phase_id?: string;
  order_code: string;
  quantity: number;
  order_date: string;
  is_oversell?: boolean;
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
    variant?: string;
    prepared_quantity: number;
    live_phase_id?: string;
    live_session_id?: string;
    image_url?: string;
  } | null>(null);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [isEditOrderItemOpen, setIsEditOrderItemOpen] = useState(false);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [editingOrderItem, setEditingOrderItem] = useState<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    orders?: OrderWithProduct[];
  } | null>(null);
  
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

  // Fetch live products for selected phase (or all phases if "all" selected)
  const { data: liveProducts = [] } = useQuery({
    queryKey: ["live-products", selectedPhase, selectedSession],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      if (selectedPhase === "all") {
        // Fetch all products for the session
        const { data, error } = await supabase
          .from("live_products")
          .select("*")
          .eq("live_session_id", selectedSession)
          .order("created_at", { ascending: true });
        
        if (error) throw error;
        
        // Aggregate products by product_code
        const aggregated = (data as LiveProduct[]).reduce((acc, product) => {
          if (!acc[product.product_code]) {
            acc[product.product_code] = {
              id: product.id, // Keep first id for reference
              live_session_id: product.live_session_id,
              live_phase_id: product.live_phase_id,
              product_code: product.product_code,
              product_name: product.product_name,
              prepared_quantity: 0,
              sold_quantity: 0,
              earliest_created_at: product.created_at,
            };
          }
          
          // Update product_name if found earlier record
          const currentCreatedAt = new Date(product.created_at || 0).getTime();
          const earliestCreatedAt = new Date(acc[product.product_code].earliest_created_at || 0).getTime();
          
          if (currentCreatedAt < earliestCreatedAt) {
            acc[product.product_code].product_name = product.product_name;
            acc[product.product_code].earliest_created_at = product.created_at;
          }
          
          // Sum quantities
          acc[product.product_code].prepared_quantity += product.prepared_quantity;
          acc[product.product_code].sold_quantity += product.sold_quantity;
          
          return acc;
        }, {} as Record<string, LiveProduct & { earliest_created_at?: string }>);
        
        return Object.values(aggregated).map(({ earliest_created_at, ...product }) => product);
      } else {
        // Fetch products for single phase
        const { data, error } = await supabase
          .from("live_products")
          .select("*")
          .eq("live_phase_id", selectedPhase)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data as LiveProduct[];
      }
    },
    enabled: !!selectedPhase && !!selectedSession,
  });

  // Fetch live orders for selected phase (or all phases if "all" selected)
  const { data: liveOrders = [] } = useQuery({
    queryKey: ["live-orders", selectedPhase, selectedSession],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      if (selectedPhase === "all") {
        // Fetch all orders for the session
        const { data, error } = await supabase
          .from("live_orders")
          .select("*")
          .eq("live_session_id", selectedSession)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data as LiveOrder[];
      } else {
        const { data, error } = await supabase
          .from("live_orders")
          .select("*")
          .eq("live_phase_id", selectedPhase)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data as LiveOrder[];
      }
    },
    enabled: !!selectedPhase && !!selectedSession,
  });

  // Fetch orders with product details for selected phase (or all phases if "all" selected)
  const { data: ordersWithProducts = [] } = useQuery({
    queryKey: ["orders-with-products", selectedPhase, selectedSession],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      if (selectedPhase === "all") {
        // Fetch all orders for the session
        const { data, error } = await supabase
          .from("live_orders")
          .select(`
            *,
            live_products (
              product_code,
              product_name
            )
          `)
          .eq("live_session_id", selectedSession)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        
        return data.map(order => ({
          ...order,
          product_code: order.live_products?.product_code || "",
          product_name: order.live_products?.product_name || "",
        })) as OrderWithProduct[];
      } else {
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
      }
    },
    enabled: !!selectedPhase && !!selectedSession,
  });

  // Delete order item mutation (delete single product from order)
  const deleteOrderItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity }: { orderId: string; productId: string; quantity: number }) => {
      // Update product sold quantity first
      const { data: product, error: productFetchError } = await supabase
        .from("live_products")
        .select("sold_quantity")
        .eq("id", productId)
        .single();

      if (productFetchError) throw productFetchError;

      const { error: updateError } = await supabase
        .from("live_products")
        .update({ 
          sold_quantity: Math.max(0, product.sold_quantity - quantity) 
        })
        .eq("id", productId);
      
      if (updateError) throw updateError;

      // Delete the order item
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
      toast.success("Đã xóa sản phẩm khỏi đơn hàng");
    },
    onError: (error) => {
      console.error("Error deleting order item:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
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

  const handleDeleteOrderItem = async (orderId: string, productId: string, quantity: number) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi đơn hàng?")) {
      await deleteOrderItemMutation.mutateAsync({ orderId, productId, quantity });
    }
  };

  const handleEditOrderItem = (aggregatedProduct: {
    product_code: string;
    product_name: string;
    live_product_id: string;
    total_quantity: number;
    orders: OrderWithProduct[];
  }) => {
    setEditingOrderItem({
      id: aggregatedProduct.orders[0].id,
      product_id: aggregatedProduct.live_product_id,
      product_name: aggregatedProduct.product_name,
      quantity: aggregatedProduct.total_quantity,
      orders: aggregatedProduct.orders,
    });
    setIsEditOrderItemOpen(true);
  };

  const handleDeleteAggregatedProduct = async (aggregatedProduct: {
    product_code: string;
    product_name: string;
    live_product_id: string;
    total_quantity: number;
    orders: OrderWithProduct[];
  }) => {
    if (window.confirm(`Bạn có chắc muốn xóa tất cả ${aggregatedProduct.total_quantity} sản phẩm ${aggregatedProduct.product_name}?`)) {
      const orderIds = aggregatedProduct.orders.map(o => o.id);
      
      try {
        // Delete all orders
        const { error: deleteError } = await supabase
          .from("live_orders")
          .delete()
          .in("id", orderIds);
        
        if (deleteError) throw deleteError;
        
        // Fetch current sold_quantity
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", aggregatedProduct.live_product_id)
          .single();
        
        if (productFetchError) throw productFetchError;
        
        // Update sold_quantity
        const { error: productError } = await supabase
          .from("live_products")
          .update({ 
            sold_quantity: Math.max(0, product.sold_quantity - aggregatedProduct.total_quantity)
          })
          .eq("id", aggregatedProduct.live_product_id);
        
        if (productError) throw productError;
        
        queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase] });
        queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase] });
        queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase] });
        toast.success("Đã xóa sản phẩm khỏi đơn hàng");
      } catch (error) {
        console.error("Error deleting aggregated product:", error);
        toast.error("Có lỗi xảy ra khi xóa sản phẩm");
      }
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
      variant: product.variant || undefined,
      prepared_quantity: product.prepared_quantity,
      live_phase_id: product.live_phase_id || selectedPhase,
      live_session_id: product.live_session_id || selectedSession,
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

    const csvData = liveProducts.map(product => ({
      "Mã sản phẩm": product.product_code,
      "Tên sản phẩm": product.product_name,
      "Biến thể": product.variant || "",
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
    
    // Generate filename based on selection
    let filename = "";
    if (selectedPhase === "all") {
      const session = liveSessions.find(s => s.id === selectedSession);
      const sessionName = session?.session_name || session?.supplier_name || "session";
      filename = `tat-ca-phien-${sessionName}-${format(new Date(), "dd-MM-yyyy")}.csv`;
    } else {
      const selectedPhaseData = livePhases.find(p => p.id === selectedPhase);
      if (selectedPhaseData) {
        filename = `danh-sach-san-pham-${format(new Date(selectedPhaseData.phase_date), "dd-MM-yyyy")}-${selectedPhaseData.phase_type}.csv`;
      }
    }
    
    link.setAttribute("download", filename);
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
          <h1 className="text-3xl font-bold tracking-tight">Order Live</h1>
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
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="all">📊 Tất cả phiên live</SelectItem>
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
                      disabled={selectedPhase === "all"}
                      className="flex items-center gap-2"
                      title={selectedPhase === "all" ? "Chọn phiên live cụ thể để thêm sản phẩm" : ""}
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
                        <TableHead>Hình ảnh</TableHead>
                        <TableHead>Biến thể</TableHead>
                        <TableHead className="text-center w-24">Tạo order</TableHead>
                        <TableHead className="text-center">SL chuẩn bị</TableHead>
                        <TableHead className="text-center">SL đã bán</TableHead>
                        <TableHead>Mã đơn hàng</TableHead>
                        <TableHead className="text-center">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Group products by product_code only
                        const productGroups = liveProducts.reduce((groups, product) => {
                          const key = product.product_code;
                          if (!groups[key]) {
                            groups[key] = {
                              product_code: product.product_code,
                              product_name: product.product_name,
                              products: []
                            };
                          }
                          groups[key].products.push(product);
                          return groups;
                        }, {} as Record<string, {
                          product_code: string;
                          product_name: string;
                          products: LiveProduct[];
                        }>);

                        return Object.values(productGroups).flatMap((group) => {
                          return group.products.map((product, productIndex) => (
                            <TableRow key={product.id}>
                              {productIndex === 0 && (
                                <>
                                  <TableCell 
                                    rowSpan={group.products.length} 
                                    className="font-medium align-top border-r"
                                  >
                                    {group.product_code}
                                  </TableCell>
                                  <TableCell 
                                    rowSpan={group.products.length}
                                    className="align-top border-r"
                                  >
                                    {group.product_name}
                                  </TableCell>
                                  <TableCell 
                                    rowSpan={group.products.length}
                                    className="align-top border-r"
                                  >
                                    {product.image_url ? (
                                      <img 
                                        src={product.image_url} 
                                        alt={group.product_name}
                                        className="w-12 h-12 object-cover rounded"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                        <Package className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                    )}
                                  </TableCell>
                                </>
                              )}
                              <TableCell className="text-muted-foreground">
                                {product.variant || "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={async () => {
                                      const qty = orderQuantities[product.id] || 1;
                                      if (!product.image_url) {
                                        toast.error("Sản phẩm chưa có hình ảnh");
                                        return;
                                      }
                                      await generateOrderImage(
                                        product.image_url,
                                        product.variant || "",
                                        qty,
                                        product.product_name
                                      );
                                    }}
                                    disabled={!product.image_url}
                                    title={product.image_url ? "Copy hình order" : "Chưa có hình ảnh"}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={orderQuantities[product.id] || 1}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 1;
                                      setOrderQuantities(prev => ({
                                        ...prev,
                                        [product.id]: value
                                      }));
                                    }}
                                    className="w-12 h-6 text-center text-xs border rounded px-1"
                                    placeholder="SL"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">{product.prepared_quantity}</TableCell>
                              <TableCell className="text-center">{product.sold_quantity}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-1">
                                  {(() => {
                                    const productOrders = selectedPhase === "all"
                                      ? ordersWithProducts.filter(order => order.product_code === product.product_code)
                                      : ordersWithProducts.filter(order => order.live_product_id === product.id);
                                    
                                    // Đếm số lần xuất hiện của mỗi order_code
                                    const orderCodeCounts = productOrders.reduce((acc, order) => {
                                      acc[order.order_code] = (acc[order.order_code] || 0) + 1;
                                      return acc;
                                    }, {} as Record<string, number>);
                                    
                                    // Lấy unique order codes để hiển thị
                                    const uniqueOrderCodes = Object.keys(orderCodeCounts);
                                    
                                    return (
                                      <>
                                        {uniqueOrderCodes.map(orderCode => {
                                          const count = orderCodeCounts[orderCode];
                                          const displayText = count > 1 ? `${orderCode} x${count}` : orderCode;
                                          
                                          return (
                                            <Badge 
                                              key={orderCode} 
                                              variant="secondary" 
                                              className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
                                            >
                                              {displayText}
                                            </Badge>
                                          );
                                        })}
                                        {selectedPhase !== "all" && (
                                          <div className="flex items-center gap-2 ml-2">
                                            <QuickAddOrder 
                                              productId={product.id}
                                              phaseId={selectedPhase}
                                              sessionId={selectedSession}
                                              availableQuantity={product.prepared_quantity - product.sold_quantity}
                                            />
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                              {productIndex === 0 && (
                                <TableCell 
                                  rowSpan={group.products.length}
                                  className="text-center align-top border-l"
                                >
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditProduct(product)}
                                      disabled={selectedPhase === "all"}
                                      title={selectedPhase === "all" ? "Chọn phiên live cụ thể để chỉnh sửa" : ""}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteProduct(product.id)}
                                      disabled={selectedPhase === "all"}
                                      className="text-red-600 hover:text-red-700"
                                      title={selectedPhase === "all" ? "Chọn phiên live cụ thể để xóa" : ""}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ));
                        });
                      })()}
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
                        <TableHead className="w-32 font-bold text-base">Mã đơn hàng</TableHead>
                        <TableHead className="w-48 font-bold text-base">Tên sản phẩm</TableHead>
                        <TableHead className="w-32 font-bold text-base">Mã sản phẩm</TableHead>
                        <TableHead className="w-20 text-center font-bold text-base">Số lượng</TableHead>
                        <TableHead className="w-24 text-center font-bold text-base">Thao tác SP</TableHead>
                        <TableHead className="w-24 text-center font-bold text-base">Trạng thái</TableHead>
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

                        return Object.entries(orderGroups).flatMap(([orderCode, orders], groupIndex) => {
                          // Group by product_code within order_code
                          const productGroups = orders.reduce((groups, order) => {
                            const key = order.product_code;
                            if (!groups[key]) {
                              groups[key] = {
                                product_code: order.product_code,
                                product_name: order.product_name,
                                live_product_id: order.live_product_id,
                                total_quantity: 0,
                                orders: [] as OrderWithProduct[]
                              };
                            }
                            groups[key].total_quantity += order.quantity;
                            groups[key].orders.push(order);
                            return groups;
                          }, {} as Record<string, {
                            product_code: string;
                            product_name: string;
                            live_product_id: string;
                            total_quantity: number;
                            orders: OrderWithProduct[];
                          }>);

                          const aggregatedProducts = Object.values(productGroups);

                          // Check if any order in this group is oversell
                          const hasOversell = aggregatedProducts.some(p => 
                            p.orders.some(order => order.is_oversell)
                          );
                          
                          return aggregatedProducts.map((product, index) => (
                            <TableRow 
                              key={`${orderCode}-${product.product_code}`}
                              className={`h-12 ${
                                index === aggregatedProducts.length - 1 
                                  ? 'border-b-2 border-border/60' 
                                  : 'border-b border-border/20'
                              } ${groupIndex % 2 === 1 ? 'bg-muted/30' : ''} ${
                                hasOversell ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : ''
                              }`}
                            >
                              {index === 0 && (
                                <TableCell 
                                  rowSpan={aggregatedProducts.length} 
                                  className="font-medium align-middle border-r border-l text-center"
                                >
                                  <div className="flex items-center justify-center gap-2">
                                    {hasOversell && (
                                      <AlertTriangle className="h-5 w-5 text-red-500" />
                                    )}
                                    <Badge className={`text-base font-bold font-mono px-3 py-1.5 ${
                                      hasOversell 
                                        ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800' 
                                        : 'bg-primary text-primary-foreground'
                                    }`}>
                                      {orderCode}
                                    </Badge>
                                  </div>
                                </TableCell>
                              )}
                              <TableCell className="py-2 border-r">
                                <div className="font-medium text-sm">{product.product_name}</div>
                              </TableCell>
                              <TableCell className="py-2 border-r">
                                <span className="text-sm">{product.product_code}</span>
                              </TableCell>
                              <TableCell className="text-center py-2 border-r">
                                <span className="text-sm font-medium">{product.total_quantity}</span>
                              </TableCell>
                              <TableCell className="text-center py-2 border-r">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditOrderItem(product)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteAggregatedProduct(product)}
                                    className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                              {index === 0 && (
                                <TableCell 
                                  rowSpan={aggregatedProducts.length}
                                  className="text-center py-2 align-middle border-r"
                                >
                                  <div className="flex items-center justify-center">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="sr-only"
                                        defaultChecked={false}
                                        onChange={(e) => {
                                          const statusElement = e.target.nextElementSibling;
                                          const dot = statusElement?.querySelector('.status-dot');
                                          const text = statusElement?.querySelector('.status-text');
                                          if (e.target.checked) {
                                            dot?.classList.remove('bg-red-500');
                                            dot?.classList.add('bg-green-500');
                                            text?.classList.remove('text-red-600');
                                            text?.classList.add('text-green-600');
                                            if (text) text.textContent = 'Hoàn tất';
                                          } else {
                                            dot?.classList.remove('bg-green-500');
                                            dot?.classList.add('bg-red-500');
                                            text?.classList.remove('text-green-600');
                                            text?.classList.add('text-red-600');
                                            if (text) text.textContent = 'Đang chờ';
                                          }
                                        }}
                                      />
                                      <div className="flex items-center gap-1">
                                        <div className="status-dot w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                        <span className="status-text text-xs text-red-600 font-medium">Đang chờ</span>
                                      </div>
                                    </label>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ));
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

      <EditOrderItemDialog 
        open={isEditOrderItemOpen}
        onOpenChange={setIsEditOrderItemOpen}
        orderItem={editingOrderItem}
        phaseId={selectedPhase}
      />
    </div>
  );
}