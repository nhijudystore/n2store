import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
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
  product_images?: string[];
  price_images?: string[];
}

interface SelectProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: Product) => void;
}

// Extract prefix (text) and number from product code
const extractCodeParts = (code: string): { prefix: string; number: number } => {
  const match = code.match(/^([^\d]+)(\d+)$/);
  if (match) {
    return { prefix: match[1], number: parseInt(match[2], 10) };
  }
  // If no number found, treat the whole code as prefix with number 0
  return { prefix: code, number: 0 };
};

// Filter to keep only products with max number for each prefix
const getMaxNumberProducts = (products: Product[]): Product[] => {
  const grouped = new Map<string, Product>();
  
  products.forEach(product => {
    const { prefix, number } = extractCodeParts(product.product_code);
    const existing = grouped.get(prefix);
    
    if (!existing) {
      grouped.set(prefix, product);
    } else {
      const existingNumber = extractCodeParts(existing.product_code).number;
      if (number > existingNumber) {
        grouped.set(prefix, product);
      }
    }
  });
  
  return Array.from(grouped.values());
};

export function SelectProductDialog({ open, onOpenChange, onSelect }: SelectProductDialogProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("product_name");

      if (error) throw error;
      return data as Product[];
    },
    enabled: open,
  });

  // Apply max number filter first
  const maxNumberProducts = getMaxNumberProducts(products);

  // Then apply search filter
  const filteredProducts = maxNumberProducts.filter((product) =>
    product.product_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.variant?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {filteredProducts.map((product) => (
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
                ))}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Không tìm thấy sản phẩm
                  </div>
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

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : (
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
                  {filteredProducts.map((product) => (
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
                  ))}
                </TableBody>
              </Table>
              {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Không tìm thấy sản phẩm
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
