import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/currency-utils";
import { Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  selling_price: number;
  purchase_price: number;
  unit: string;
  stock_quantity: number;
  supplier_name?: string;
}

interface SelectProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: Product) => void;
}

export function SelectProductDialog({ open, onOpenChange, onSelect }: SelectProductDialogProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-select", "v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10000);

      if (error) throw error;
      return data as Product[];
    },
    enabled: open,
  });

  // Simple filter with client-side sorting
  const filteredProducts = useMemo(() => {
    let result = products;
    
    // Filter by search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      result = products.filter((product) =>
        product.product_code?.toLowerCase().includes(searchLower) ||
        product.product_name?.toLowerCase().includes(searchLower) ||
        product.variant?.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by product_code DESC (like before)
    return [...result].sort((a, b) => 
      b.product_code.localeCompare(a.product_code)
    );
  }, [searchQuery, products]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    onOpenChange(false);
  };

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Tìm kiếm sản phẩm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <Card
                      key={product.id}
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelect(product)}
                    >
                      <div className="space-y-2">
                        <div className="font-semibold">{product.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.product_code}
                          {product.variant && ` - ${product.variant}`}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Giá mua: </span>
                            <span className="font-medium">{formatVND(product.purchase_price)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Giá bán: </span>
                            <span className="font-medium">{formatVND(product.selling_price)}</span>
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Tồn: </span>
                          <span className={product.stock_quantity < 0 ? 'text-red-500' : ''}>
                            {product.stock_quantity}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <Input
            placeholder="Tìm kiếm theo mã SP, tên sản phẩm, variant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã SP</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Giá mua</TableHead>
                  <TableHead>Giá bán</TableHead>
                  <TableHead>Tồn</TableHead>
                  <TableHead>NCC</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.variant || "-"}
                      </TableCell>
                      <TableCell>{formatVND(product.purchase_price)}</TableCell>
                      <TableCell>{formatVND(product.selling_price)}</TableCell>
                      <TableCell>
                        <span className={product.stock_quantity < 0 ? 'text-red-500' : ''}>
                          {product.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.supplier_name || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSelect(product)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Chọn
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
