import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Store, Package, TrendingUp } from "lucide-react";

interface LiveProduct {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string | null;
  prepared_quantity: number;
  sold_quantity: number;
}

interface SupplierStat {
  supplier_name: string;
  product_count: number;
  total_prepared: number;
  total_sold: number;
  total_remaining: number;
  sell_through_rate: number;
}

interface LiveSupplierStatsProps {
  liveProducts: LiveProduct[];
  sessionId: string;
  phaseId: string;
}

export function LiveSupplierStats({ liveProducts }: LiveSupplierStatsProps) {
  // Query products table to get supplier_name for each product_code
  const { data: productsData } = useQuery({
    queryKey: ["products-supplier", liveProducts.map(p => p.product_code)],
    queryFn: async () => {
      if (liveProducts.length === 0) return [];
      
      const productCodes = [...new Set(liveProducts.map(p => p.product_code))];
      
      const { data, error } = await supabase
        .from("products")
        .select("product_code, supplier_name")
        .in("product_code", productCodes);
      
      if (error) throw error;
      return data || [];
    },
    enabled: liveProducts.length > 0,
  });

  // Calculate supplier statistics
  const supplierStats: SupplierStat[] = (() => {
    if (!productsData) return [];

    const statsMap = new Map<string, SupplierStat>();

    liveProducts.forEach(liveProduct => {
      const productInfo = productsData.find(p => p.product_code === liveProduct.product_code);
      const supplierName = productInfo?.supplier_name || "Chưa xác định";

      if (!statsMap.has(supplierName)) {
        statsMap.set(supplierName, {
          supplier_name: supplierName,
          product_count: 0,
          total_prepared: 0,
          total_sold: 0,
          total_remaining: 0,
          sell_through_rate: 0,
        });
      }

      const stat = statsMap.get(supplierName)!;
      
      // Count unique products by product_code
      const existingProductCodes = new Set<string>();
      liveProducts.forEach(p => {
        const pInfo = productsData.find(pd => pd.product_code === p.product_code);
        if (pInfo?.supplier_name === supplierName || (!pInfo?.supplier_name && supplierName === "Chưa xác định")) {
          existingProductCodes.add(p.product_code);
        }
      });
      stat.product_count = existingProductCodes.size;

      stat.total_prepared += liveProduct.prepared_quantity;
      stat.total_sold += liveProduct.sold_quantity;
    });

    // Calculate remaining and sell-through rate
    statsMap.forEach(stat => {
      stat.total_remaining = stat.total_prepared - stat.total_sold;
      stat.sell_through_rate = stat.total_prepared > 0 
        ? (stat.total_sold / stat.total_prepared) * 100 
        : 0;
    });

    // Convert to array and sort by total_sold (descending)
    return Array.from(statsMap.values()).sort((a, b) => b.total_sold - a.total_sold);
  })();

  // Get color based on sell-through rate
  const getSellThroughColor = (rate: number) => {
    if (rate >= 80) return "text-green-600 dark:text-green-400";
    if (rate >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  // Get badge variant based on sell-through rate
  const getSellThroughBadgeVariant = (rate: number): "default" | "secondary" | "destructive" => {
    if (rate >= 80) return "default";
    if (rate >= 50) return "secondary";
    return "destructive";
  };

  if (liveProducts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Store className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Chưa có dữ liệu</h3>
          <p className="text-muted-foreground text-center">
            Thêm sản phẩm vào phiên live để xem thống kê theo nhà cung cấp
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Thống kê theo Nhà cung cấp
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Package className="h-4 w-4" />
                    Số SP
                  </div>
                </TableHead>
                <TableHead className="text-center">SL chuẩn bị</TableHead>
                <TableHead className="text-center">SL đã bán</TableHead>
                <TableHead className="text-center">SL còn lại</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Tỷ lệ bán
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                supplierStats.map((stat) => (
                  <TableRow key={stat.supplier_name}>
                    <TableCell className="font-medium">
                      {stat.supplier_name}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {stat.product_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {stat.total_prepared.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-medium text-primary">
                      {stat.total_sold.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {stat.total_remaining.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant={getSellThroughBadgeVariant(stat.sell_through_rate)}>
                          {stat.sell_through_rate.toFixed(1)}%
                        </Badge>
                        <span className={`text-sm font-medium ${getSellThroughColor(stat.sell_through_rate)}`}>
                          {stat.sell_through_rate >= 80 ? "Tốt" : stat.sell_through_rate >= 50 ? "TB" : "Thấp"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {supplierStats.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
              Tỷ lệ bán ≥ 80%: Hiệu suất tốt
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span>
              Tỷ lệ bán 50-79%: Trung bình
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
              Tỷ lệ bán &lt; 50%: Cần cải thiện
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
