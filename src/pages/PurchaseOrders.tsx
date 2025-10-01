import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package, FileText, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { PurchaseOrderList } from "@/components/purchase-orders/PurchaseOrderList";
import { CreatePurchaseOrderDialog } from "@/components/purchase-orders/CreatePurchaseOrderDialog";
import { PurchaseOrderStats } from "@/components/purchase-orders/PurchaseOrderStats";
import { format } from "date-fns";

interface PurchaseOrderItem {
  product_name: string;
  product_code: string | null;
  variant: string | null;
  quantity: number;
  unit_price: number;
  selling_price: number;
  product_images: string[] | null;
  price_images: string[] | null;
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
  supplier_id?: string | null;
  notes: string | null;
  invoice_date: string | null;
  invoice_images: string[] | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
}

const PurchaseOrders = () => {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Filter states moved from PurchaseOrderList
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<string>("all");

  const applyQuickFilter = (filterType: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(filterType) {
      case "today":
        setDateFrom(today);
        setDateTo(new Date());
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateFrom(yesterday);
        setDateTo(yesterday);
        break;
      case "7days":
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        setDateFrom(sevenDaysAgo);
        setDateTo(new Date());
        break;
      case "30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        setDateFrom(thirtyDaysAgo);
        setDateTo(new Date());
        break;
      case "thisMonth":
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setDateFrom(firstDayOfMonth);
        setDateTo(new Date());
        break;
      case "lastMonth":
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateFrom(firstDayOfLastMonth);
        setDateTo(lastDayOfLastMonth);
        break;
      case "all":
        setDateFrom(undefined);
        setDateTo(undefined);
        break;
    }
    setQuickFilter(filterType);
  };

  // Data fetching moved from PurchaseOrderList
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
            .select("product_name, product_code, variant, quantity, unit_price, selling_price, product_images, price_images")
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

  // Filtering logic moved from PurchaseOrderList
  const filteredOrders = orders?.filter(order => {
    // Date range filter
    if (dateFrom || dateTo) {
      const orderDate = new Date(order.order_date);
      orderDate.setHours(0, 0, 0, 0);
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (orderDate < fromDate) return false;
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate) return false;
      }
    }
    
    // Enhanced search - bao gồm search theo định dạng ngày dd/mm
    const matchesSearch = searchTerm === "" || 
      order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      format(new Date(order.order_date), "dd/MM").includes(searchTerm) ||
      format(new Date(order.order_date), "dd/MM/yyyy").includes(searchTerm) ||
      order.items?.some(item => 
        item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    // Status filter
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const handleExportExcel = () => {
    // Flatten all items from filteredOrders
    const products = filteredOrders.flatMap(order => 
      (order.items || []).map(item => ({
        ...item,
        order_id: order.id,
        order_date: order.order_date,
        supplier_name: order.supplier_name,
        order_notes: order.notes
      }))
    );

    if (products.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Không có sản phẩm nào để xuất",
        variant: "destructive",
      });
      return;
    }

    try {
      // Mapping according to the Excel template format (17 columns)
      const excelData = products.map(item => ({
        "Loại sản phẩm": "Có thể lưu trữ",
        "Mã sản phẩm": item.product_code?.toString() || undefined,
        "Mã chốt đơn": undefined,
        "Tên sản phẩm": item.product_name?.toString() || undefined,
        "Giá bán": item.selling_price || 0,
        "Giá mua": item.unit_price || 0,
        "Đơn vị": "CÁI",
        "Nhóm sản phẩm": "QUẦN ÁO",
        "Mã vạch": item.product_code?.toString() || undefined,
        "Khối lượng": undefined,
        "Chiết khấu bán": undefined,
        "Chiết khấu mua": undefined,
        "Tồn kho": undefined,
        "Giá vốn": undefined,
        "Ghi chú": undefined,
        "Cho phép bán ở công ty khác": "FALSE",
        "Thuộc tính": undefined,
      }));

      // Create Excel file
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Đặt Hàng");
      
      const fileName = `DatHang_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Xuất Excel thành công!",
        description: `Đã tạo file ${fileName}`,
      });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast({
        title: "Lỗi khi xuất Excel!",
        description: "Vui lòng thử lại",
        variant: "destructive",
      });
    }
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý đặt hàng</h1>
          <p className="text-muted-foreground">
            Theo dõi và quản lý đơn đặt hàng với các nhà cung cấp
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Tạo đơn đặt hàng
        </Button>
      </div>

      <PurchaseOrderStats 
        filteredOrders={filteredOrders}
        allOrders={orders || []}
        isLoading={isLoading}
      />

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orders" className="gap-2">
            <FileText className="w-4 h-4" />
            Đơn đặt hàng
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" />
            Sản phẩm đã đặt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Danh sách đơn đặt hàng</CardTitle>
                  <CardDescription>
                    Xem và quản lý tất cả đơn đặt hàng với nhà cung cấp
                  </CardDescription>
                </div>
                <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Xuất excel thêm sản phẩm
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PurchaseOrderList 
                filteredOrders={filteredOrders}
                isLoading={isLoading}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                dateFrom={dateFrom}
                setDateFrom={setDateFrom}
                dateTo={dateTo}
                setDateTo={setDateTo}
                quickFilter={quickFilter}
                applyQuickFilter={applyQuickFilter}
              />
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="products" className="space-y-4">
          <Card>
          <CardHeader>
              <CardTitle>Sản phẩm đã đặt</CardTitle>
              <CardDescription>
                Xem danh sách các sản phẩm đã đặt hàng từ nhà cung cấp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Chức năng đang phát triển</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreatePurchaseOrderDialog 
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default PurchaseOrders;