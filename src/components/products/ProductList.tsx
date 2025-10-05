import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { formatVND } from "@/lib/currency-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { EditProductDialog } from "./EditProductDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProductImage } from "./ProductImage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  selling_price: number;
  purchase_price: number;
  unit: string;
  category?: string;
  barcode?: string;
  stock_quantity: number;
  supplier_name?: string;
  product_images?: string[];
  price_images?: string[];
  tpos_image_url?: string;
  tpos_product_id?: number;
}

interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  onRefetch: () => void;
}

export function ProductList({ products, isLoading, onRefetch }: ProductListProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const handleDelete = async () => {
    if (!deletingProduct) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deletingProduct.id);

    if (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa sản phẩm",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Thành công",
        description: "Đã xóa sản phẩm",
      });
      onRefetch();
    }
    setDeletingProduct(null);
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">Đang tải...</div>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          Không có sản phẩm nào
        </div>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <>
        <div className="space-y-4">
          {products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">
                      {product.product_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {product.product_code}
                    </div>
                    {product.variant && (
                      <div className="text-xs text-muted-foreground">
                      {product.variant}
                    </div>
                  )}
                </div>
                <ProductImage 
                  productId={product.id}
                  productCode={product.product_code}
                  productImages={product.product_images}
                  tposImageUrl={product.tpos_image_url}
                  tposProductId={product.tpos_product_id}
                />
                </div>
                
                <ProductImage 
                  productId={product.id}
                  productCode={product.product_code}
                  productImages={product.product_images}
                  tposImageUrl={product.tpos_image_url}
                  tposProductId={product.tpos_product_id}
                />

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Giá bán: </span>
                    <span className="font-medium">{formatVND(product.selling_price)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tồn: </span>
                    <span className={`font-medium ${product.stock_quantity < 0 ? 'text-red-500' : ''}`}>
                      {product.stock_quantity}
                    </span>
                  </div>
                </div>

                {product.category && (
                  <div className="text-xs text-muted-foreground">
                    {product.category}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProduct(product)}
                    className="flex-1"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Sửa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingProduct(product)}
                    className="flex-1"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Xóa
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onSuccess={onRefetch}
        />

        <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc muốn xóa sản phẩm "{deletingProduct?.product_name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Xóa</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hình ảnh</TableHead>
              <TableHead>Mã SP</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Giá bán</TableHead>
              <TableHead>Giá mua</TableHead>
              <TableHead>Tồn kho</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead>NCC</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <ProductImage 
                    productId={product.id}
                    productCode={product.product_code}
                    productImages={product.product_images}
                    tposImageUrl={product.tpos_image_url}
                    tposProductId={product.tpos_product_id}
                  />
                </TableCell>
                <TableCell className="font-medium">{product.product_code}</TableCell>
                <TableCell>{product.product_name}</TableCell>
                <TableCell className="text-muted-foreground">{product.variant || "-"}</TableCell>
                <TableCell>{formatVND(product.selling_price)}</TableCell>
                <TableCell>{formatVND(product.purchase_price)}</TableCell>
                <TableCell>
                  <span className={product.stock_quantity < 0 ? 'text-red-500 font-semibold' : ''}>
                    {product.stock_quantity}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{product.category || "-"}</TableCell>
                <TableCell className="text-muted-foreground">{product.supplier_name || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingProduct(product)}
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

      <EditProductDialog
        product={editingProduct}
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        onSuccess={onRefetch}
      />

      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa sản phẩm "{deletingProduct?.product_name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
