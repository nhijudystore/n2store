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
import { convertVietnameseToUpperCase } from "@/lib/utils";
import { Check, Info } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";

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

interface NormalizedProduct extends Product {
  _normalized: {
    code: string;
    name: string;
    variant: string;
  };
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

// Sort products by number (largest first), then by name
const sortProductsByNumber = (products: Product[]): Product[] => {
  return [...products].sort((a, b) => {
    const aNum = extractCodeParts(a.product_code).number;
    const bNum = extractCodeParts(b.product_code).number;
    
    // Sort by number descending (largest first)
    if (aNum !== bNum) {
      return bNum - aNum;
    }
    
    // If same number, sort by product name
    return a.product_name.localeCompare(b.product_name);
  });
};

const MAX_DISPLAY_RESULTS = 30;

export function SelectProductDialog({ open, onOpenChange, onSelect }: SelectProductDialogProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 150);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_code, product_name, variant, selling_price, purchase_price, unit, stock_quantity, supplier_name")
        .order("product_code", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: open,
  });

  // Memoize normalized products - only run once when products change
  const normalizedProducts = useMemo<NormalizedProduct[]>(() => 
    products.map(p => ({
      ...p,
      _normalized: {
        code: convertVietnameseToUpperCase(p.product_code || ""),
        name: convertVietnameseToUpperCase(p.product_name || ""),
        variant: convertVietnameseToUpperCase(p.variant || "")
      }
    })), 
  [products]);

  // Filter products using pre-normalized data
  const searchFiltered = useMemo(() => {
    if (!debouncedSearchQuery) return normalizedProducts;
    
    const normalizedSearch = convertVietnameseToUpperCase(debouncedSearchQuery);
    return normalizedProducts.filter((product) => 
      product._normalized.code.includes(normalizedSearch) ||
      product._normalized.name.includes(normalizedSearch) ||
      product._normalized.variant.includes(normalizedSearch)
    );
  }, [debouncedSearchQuery, normalizedProducts]);

  // Sort only the filtered results
  const sortedProducts = useMemo(() => 
    sortProductsByNumber(searchFiltered),
  [searchFiltered]);

  // Limit displayed results
  const displayedProducts = sortedProducts.slice(0, MAX_DISPLAY_RESULTS);
  const hasMoreResults = sortedProducts.length > MAX_DISPLAY_RESULTS;
  const hiddenCount = sortedProducts.length - MAX_DISPLAY_RESULTS;

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
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {displayedProducts.map((product) => (
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
                {displayedProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Không tìm thấy sản phẩm
                  </div>
                )}
                {hasMoreResults && (
                  <Card className="p-3 bg-muted/50 border-dashed">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <span>
                        Đang hiển thị {MAX_DISPLAY_RESULTS} kết quả đầu tiên. 
                        Còn {hiddenCount} sản phẩm khác - hãy tìm kiếm cụ thể hơn.
                      </span>
                    </div>
                  </Card>
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
            <div className="border rounded-lg overflow-hidden">
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
                  {[...Array(5)].map((_, i) => (
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
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <>
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
                    {displayedProducts.map((product) => (
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
                {displayedProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Không tìm thấy sản phẩm
                  </div>
                )}
              </div>
              {hasMoreResults && (
                <Card className="p-3 bg-muted/50 border-dashed mt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>
                      Đang hiển thị {MAX_DISPLAY_RESULTS} kết quả đầu tiên. 
                      Còn {hiddenCount} sản phẩm khác - hãy tìm kiếm cụ thể hơn.
                    </span>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
