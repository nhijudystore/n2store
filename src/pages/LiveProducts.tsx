import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateLiveSessionDialog } from "@/components/live-products/CreateLiveSessionDialog";
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

interface OrderWithProduct extends LiveOrder {
  product_code: string;
  product_name: string;
  product_images?: string[];
}

export default function LiveProducts() {
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("products");
  // Removed expandedSessions state as we no longer need expand/collapse
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    product_code: string;
    product_name: string;
    prepared_quantity: number;
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

  // Fetch orders with product details for order list tab
  const { data: ordersWithProducts = [] } = useQuery({
    queryKey: ["orders-with-products", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      
      const { data: orders, error: ordersError } = await supabase
        .from("live_orders")
        .select(`
          *,
          live_products!inner(
            product_code,
            product_name
          )
        `)
        .eq("live_session_id", selectedSession)
        .order("order_date", { ascending: false });
      
      if (ordersError) throw ordersError;

      // Get product images from purchase_order_items
      const ordersWithImages = await Promise.all(
        orders.map(async (order: any) => {
          const { data: purchaseItems } = await supabase
            .from("purchase_order_items")
            .select("product_images")
            .eq("product_name", order.live_products.product_name)
            .limit(1);

          return {
            ...order,
            product_code: order.live_products.product_code,
            product_name: order.live_products.product_name,
            product_images: purchaseItems?.[0]?.product_images || []
          } as OrderWithProduct;
        })
      );

      return ordersWithImages;
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
      queryClient.invalidateQueries({ queryKey: ["live-orders", selectedSession] });
      queryClient.invalidateQueries({ queryKey: ["live-products", selectedSession] });
      toast.success("Đã xóa đơn hàng thành công");
    },
    onError: (error) => {
      console.error("Error deleting order:", error);
      toast.error("Có lỗi xảy ra khi xóa đơn hàng");
    },
  });

  // Delete product mutation (cascade delete orders)
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      // First delete all orders for this product
      const { error: ordersError } = await supabase
        .from("live_orders")
        .delete()
        .eq("live_product_id", productId);
      
      if (ordersError) throw ordersError;

      // Then delete the product
      const { error: productError } = await supabase
        .from("live_products")
        .delete()
        .eq("id", productId);
      
      if (productError) throw productError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", selectedSession] });
      queryClient.invalidateQueries({ queryKey: ["live-products", selectedSession] });
      toast.success("Đã xóa sản phẩm và tất cả đơn hàng liên quan");
    },
    onError: (error) => {
      console.error("Error deleting product:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    },
  });

  // Delete live session mutation (cascade delete products and orders)
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // First delete all orders in this session
      const { error: ordersError } = await supabase
        .from("live_orders")
        .delete()
        .eq("live_session_id", sessionId);
      
      if (ordersError) throw ordersError;

      // Then delete all products in this session
      const { error: productsError } = await supabase
        .from("live_products")
        .delete()
        .eq("live_session_id", sessionId);
      
      if (productsError) throw productsError;

      // Finally delete the session
      const { error: sessionError } = await supabase
        .from("live_sessions")
        .delete()
        .eq("id", sessionId);
      
      if (sessionError) throw sessionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["live-orders"] });
      queryClient.invalidateQueries({ queryKey: ["live-products"] });
      toast.success("Đã xóa đợt live và tất cả dữ liệu liên quan");
      
      // Reset selected session if it was deleted
      if (liveSessions.length > 1) {
        const remainingSessions = liveSessions.filter(s => s.id !== selectedSession);
        setSelectedSession(remainingSessions[0]?.id || "");
      } else {
        setSelectedSession("");
      }
    },
    onError: (error) => {
      console.error("Error deleting session:", error);
      toast.error("Có lỗi xảy ra khi xóa đợt live");
    },
  });

  const handleDeleteOrder = (orderId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa đơn hàng này?")) {
      deleteOrderMutation.mutate(orderId);
    }
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    const productOrders = liveOrders.filter(order => order.live_product_id === productId);
    const confirmMessage = productOrders.length > 0 
      ? `Bạn có chắc chắn muốn xóa sản phẩm "${productName}"? Điều này sẽ xóa ${productOrders.length} đơn hàng liên quan.`
      : `Bạn có chắc chắn muốn xóa sản phẩm "${productName}"?`;
    
    if (confirm(confirmMessage)) {
      deleteProductMutation.mutate(productId);
    }
  };

  const handleDeleteSession = (sessionId: string, sessionName: string) => {
    const sessionProducts = liveProducts.length;
    const sessionOrders = liveOrders.length;
    
    let confirmMessage = `Bạn có chắc chắn muốn xóa đợt live "${sessionName}"?`;
    if (sessionProducts > 0) {
      confirmMessage += ` Điều này sẽ xóa ${sessionProducts} sản phẩm`;
      if (sessionOrders > 0) {
        confirmMessage += ` và ${sessionOrders} đơn hàng`;
      }
      confirmMessage += " liên quan.";
    }
    
    if (confirm(confirmMessage)) {
      deleteSessionMutation.mutate(sessionId);
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
            <div key={session.id} className="relative inline-flex">
              <TabsTrigger value={session.id} className="gap-2 pr-8">
                <Calendar className="w-4 h-4" />
                {format(new Date(session.session_date), "dd/MM/yyyy", { locale: vi })} - {session.supplier_name}
              </TabsTrigger>
              {liveSessions.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(
                      session.id, 
                      `${format(new Date(session.session_date), "dd/MM/yyyy", { locale: vi })} - ${session.supplier_name}`
                    );
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </TabsList>

        {liveSessions.map((session) => (
          <TabsContent key={session.id} value={session.id} className="space-y-4">
            <LiveSessionStats 
              sessionId={session.id}
              products={liveProducts}
              orders={liveOrders}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="products" className="gap-2">
                  <Package className="w-4 h-4" />
                  Sản phẩm
                </TabsTrigger>
                <TabsTrigger value="orders" className="gap-2">
                  <ListOrdered className="w-4 h-4" />
                  Đơn hàng
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products">
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
                                <div className="col-span-6 md:col-span-2">
                                  <QuickAddOrder sessionId={selectedSession} productId={product.id} />
                                </div>
                                
                                {/* Edit and Delete Product Buttons */}
                                <div className="col-span-6 md:col-span-1 flex justify-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditProduct(product)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteProduct(product.id, product.product_name)}
                                    className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {liveProducts.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Chưa có sản phẩm nào trong đợt live này</p>
                          <p className="text-sm">Thêm sản phẩm để bắt đầu bán hàng</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="orders">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListOrdered className="w-5 h-5" />
                      Danh sách đơn hàng
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ordersWithProducts.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mã đơn hàng</TableHead>
                            <TableHead>Hình ảnh</TableHead>
                            <TableHead>Tên sản phẩm</TableHead>
                            <TableHead className="text-center">Số lượng</TableHead>
                            <TableHead>Giá</TableHead>
                            <TableHead>Tổng tiền</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="text-center">Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            // Group orders by order_code
                            const groupedOrders = ordersWithProducts.reduce((acc, order) => {
                              if (!acc[order.order_code]) {
                                acc[order.order_code] = [];
                              }
                              acc[order.order_code].push(order);
                              return acc;
                            }, {} as Record<string, typeof ordersWithProducts>);

                            return Object.entries(groupedOrders).map(([orderCode, orders]) => {
                              const firstOrder = orders[0];
                              const totalQuantity = orders.reduce((sum, order) => sum + order.quantity, 0);
                              
                              return orders.map((order, index) => (
                                <TableRow key={order.id}>
                                  {/* Order Code - only show for first row of each group */}
                                  {index === 0 ? (
                                    <TableCell rowSpan={orders.length} className="align-top border-r">
                                      <div className="space-y-2">
                                        <Badge variant="outline" className="font-mono text-base">
                                          {orderCode}
                                        </Badge>
                                        <div className="text-xs text-muted-foreground">
                                          Tổng: {totalQuantity} sản phẩm
                                        </div>
                                      </div>
                                    </TableCell>
                                  ) : null}
                                  
                                  
                                  {/* Product Image */}
                                  <TableCell>
                                    {order.product_images && order.product_images.length > 0 ? (
                                      <div className="flex gap-1">
                                        {order.product_images.slice(0, 1).map((image, imgIndex) => (
                                          <img
                                            key={imgIndex}
                                            src={image}
                                            alt={order.product_name}
                                            className="w-10 h-10 object-cover rounded border"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                        ))}
                                        {order.product_images.length > 1 && (
                                          <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center text-xs">
                                            +{order.product_images.length - 1}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center">
                                        <Package className="w-4 h-4 text-muted-foreground" />
                                      </div>
                                    )}
                                  </TableCell>
                                  
                                  {/* Product Name */}
                                  <TableCell>
                                    <div className="font-medium">{order.product_name}</div>
                                    <div className="text-xs text-muted-foreground font-mono">
                                      {order.product_code}
                                    </div>
                                  </TableCell>
                                  
                                  {/* Quantity */}
                                  <TableCell className="text-center">
                                    <Badge variant="secondary">
                                      {order.quantity}
                                    </Badge>
                                  </TableCell>
                                  
                                  {/* Price */}
                                  <TableCell>
                                    <div className="text-sm text-muted-foreground">-</div>
                                  </TableCell>
                                  
                                  {/* Total */}
                                  <TableCell>
                                    <div className="text-sm text-muted-foreground">-</div>
                                  </TableCell>
                                  
                                  {/* Status */}
                                  <TableCell>
                                    <Badge variant="outline" className="text-green-600">
                                      Đang chờ
                                    </Badge>
                                  </TableCell>
                                  
                                  {/* Actions - only show for first row of each group */}
                                  {index === 0 ? (
                                    <TableCell rowSpan={orders.length} className="text-center align-top border-l">
                                      <div className="flex flex-col gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            toast.info("Chức năng chỉnh sửa đang được phát triển");
                                          }}
                                          className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            // Delete all orders with this order_code
                                            if (confirm(`Bạn có chắc chắn muốn xóa tất cả sản phẩm trong đơn hàng ${orderCode}?`)) {
                                              orders.forEach(o => handleDeleteOrder(o.id));
                                            }
                                          }}
                                          className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              ));
                            });
                          })()}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Chưa có đơn hàng nào trong đợt live này</p>
                        <p className="text-sm">Đơn hàng sẽ hiển thị khi có khách đặt mua</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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

      <EditProductDialog
        open={isEditProductOpen}
        onOpenChange={setIsEditProductOpen}
        product={editingProduct}
      />

    </div>
  );
}