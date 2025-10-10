import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Barcode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProductImage } from "@/components/products/ProductImage";

interface TestProduct {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string | null;
  selling_price: number;
  purchase_price: number;
  stock_quantity: number;
  supplier_name?: string | null;
  product_images?: string[] | null;
  tpos_image_url?: string | null;
  quantity: number; // Số lượng được thêm
}

export function BarcodeProductTest() {
  const [barcode, setBarcode] = useState("");
  const [testProducts, setTestProducts] = useState<TestProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Global keyboard listener để bắt barcode scan ở bất kỳ đâu
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang focus vào textarea, input khác, hoặc contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && target !== inputRef.current) ||
        target.isContentEditable
      ) {
        return;
      }

      // Bỏ qua các phím điều khiển (trừ Enter)
      if (e.key.length > 1 && e.key !== 'Enter') {
        return;
      }

      // Nếu là Enter, xử lý barcode đã scan
      if (e.key === 'Enter') {
        e.preventDefault();
        if (barcodeBufferRef.current.trim().length > 0) {
          handleBarcodeSearch(barcodeBufferRef.current.trim());
          barcodeBufferRef.current = "";
        }
        return;
      }

      // Thêm ký tự vào buffer
      barcodeBufferRef.current += e.key;
      setBarcode(barcodeBufferRef.current);

      // Clear timeout cũ
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set timeout mới - nếu 200ms không có ký tự nào nữa, reset buffer
      // (barcode scanner quét rất nhanh, < 100ms giữa các ký tự)
      timeoutRef.current = setTimeout(() => {
        // Nếu buffer không kết thúc bằng Enter sau 200ms, có thể là gõ tay
        // Giữ nguyên buffer để người dùng có thể nhấn Enter thủ công
      }, 200);
    };

    window.addEventListener('keydown', handleGlobalKeyPress);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Auto focus input khi component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBarcodeSearch = async (code: string) => {
    if (!code.trim()) return;

    setIsSearching(true);
    try {
      // Tìm sản phẩm theo product_code
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("product_code", code.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Kiểm tra xem sản phẩm đã có trong danh sách test chưa
        const existingIndex = testProducts.findIndex(p => p.product_code === data.product_code);
        
        if (existingIndex >= 0) {
          // Nếu đã có, tăng quantity lên 1
          const updated = [...testProducts];
          updated[existingIndex].quantity += 1;
          setTestProducts(updated);
          toast.success(`Đã tăng số lượng: ${data.product_name} (x${updated[existingIndex].quantity})`);
        } else {
          // Nếu chưa có, thêm mới với quantity = 1
          const newProduct: TestProduct = {
            ...data,
            quantity: 1,
          };
          setTestProducts([newProduct, ...testProducts]);
          toast.success(`Đã thêm: ${data.product_name}`);
        }
        
        // Reset barcode input và buffer
        setBarcode("");
        barcodeBufferRef.current = "";
      } else {
        toast.error(`Không tìm thấy sản phẩm với mã: ${code}`);
        setBarcode("");
        barcodeBufferRef.current = "";
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Lỗi tìm kiếm sản phẩm");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSearch = () => {
    if (barcode.trim()) {
      handleBarcodeSearch(barcode.trim());
    }
  };

  const handleRemoveProduct = (productCode: string) => {
    setTestProducts(testProducts.filter(p => p.product_code !== productCode));
    toast.success("Đã xóa sản phẩm");
  };

  const handleClearAll = () => {
    setTestProducts([]);
    toast.success("Đã xóa toàn bộ");
  };

  const totalProducts = testProducts.length;
  const totalQuantity = testProducts.reduce((sum, p) => sum + p.quantity, 0);
  const totalValue = testProducts.reduce((sum, p) => sum + (p.selling_price * p.quantity), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Barcode className="h-5 w-5" />
          Test Quét Barcode Thêm Sản Phẩm
        </CardTitle>
        <CardDescription>
          Nhập hoặc quét mã sản phẩm để tự động thêm vào bảng (Enter để tìm)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hiển thị barcode đang được quét */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 p-3 bg-muted rounded-lg border-2 border-dashed">
            <div className="text-xs text-muted-foreground mb-1">Mã đang quét:</div>
            <div className="font-mono text-lg font-bold">
              {barcode || <span className="text-muted-foreground">Chờ quét barcode...</span>}
            </div>
            {isSearching && (
              <div className="text-xs text-blue-600 mt-1">Đang tìm kiếm...</div>
            )}
          </div>
          <Button 
            onClick={handleManualSearch}
            disabled={!barcode.trim() || isSearching}
            size="lg"
          >
            {isSearching ? "Đang tìm..." : "Tìm thủ công"}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
          <strong>💡 Hướng dẫn:</strong> Chỉ cần quét barcode bằng máy quét - hệ thống tự động nhận diện và thêm sản phẩm (không cần click chuột)
        </div>

        {/* Thống kê */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="text-sm text-muted-foreground">Số SP</div>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="text-sm text-muted-foreground">Tổng SL</div>
            <div className="text-2xl font-bold">{totalQuantity}</div>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
            <div className="text-sm text-muted-foreground">Tổng giá trị</div>
            <div className="text-2xl font-bold">
              {totalValue.toLocaleString('vi-VN')}đ
            </div>
          </div>
        </div>

        {/* Bảng sản phẩm test */}
        {testProducts.length > 0 && (
          <>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Danh sách sản phẩm đã quét</h3>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Xóa tất cả
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Ảnh</TableHead>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Biến thể</TableHead>
                    <TableHead>Số lượng</TableHead>
                    <TableHead>Giá bán</TableHead>
                    <TableHead>Tồn kho</TableHead>
                    <TableHead>Nhà cung cấp</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testProducts.map((product) => (
                    <TableRow key={product.product_code}>
                      <TableCell>
                        <ProductImage
                          productId={product.id}
                          productCode={product.product_code}
                          productImages={product.product_images}
                          tposImageUrl={product.tpos_image_url}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {product.product_code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.product_name}
                      </TableCell>
                      <TableCell>
                        {product.variant ? (
                          <Badge variant="outline">{product.variant}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-600 hover:bg-green-700">
                          x{product.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.selling_price.toLocaleString('vi-VN')}đ
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.stock_quantity > 0 ? "default" : "destructive"}
                        >
                          {product.stock_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {product.supplier_name ? (
                          <Badge variant="secondary">{product.supplier_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveProduct(product.product_code)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {testProducts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Barcode className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Chưa có sản phẩm nào. Quét barcode để bắt đầu.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
