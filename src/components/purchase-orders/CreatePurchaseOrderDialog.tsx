import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, Copy, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantSelector } from "./VariantSelector";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";

interface PurchaseOrderItem {
  product_name: string;
  variant: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  selling_price: number;
  total_price: number;
  product_images: string[];
  price_images: string[];
}

interface CreatePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePurchaseOrderDialog({ open, onOpenChange }: CreatePurchaseOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper function to parse number input from text
  const parseNumberInput = (value: string): number => {
    const numericValue = value.replace(/[^\d]/g, '');
    return numericValue === '' ? 0 : parseInt(numericValue, 10);
  };

  const [formData, setFormData] = useState({
    supplier_name: "",
    order_date: new Date().toISOString(),
    notes: "",
    invoice_images: [] as string[],
    invoice_amount: 0,
    discount_amount: 0
  });

  const [items, setItems] = useState<PurchaseOrderItem[]>([
    { product_name: "", variant: "", product_code: "", quantity: 1, unit_price: 0, selling_price: 0, total_price: 0, product_images: [], price_images: [] }
  ]);


  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!formData.supplier_name.trim()) {
        throw new Error("Vui lòng nhập tên nhà cung cấp");
      }

      const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0) * 1000;
      const discountAmount = formData.discount_amount * 1000;
      const finalAmount = totalAmount - discountAmount;

      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_name: formData.supplier_name.trim(),
          order_date: formData.order_date,
          total_amount: totalAmount,
          final_amount: finalAmount,
          discount_amount: discountAmount,
          invoice_images: formData.invoice_images.length > 0 ? formData.invoice_images : null,
          notes: formData.notes
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items
        .filter(item => item.product_name.trim())
        .map((item, index) => ({
          purchase_order_id: order.id,
          product_name: item.product_name,
          variant: item.variant,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price: item.unit_price * 1000,
          selling_price: item.selling_price * 1000,
          total_price: item.total_price * 1000,
          product_images: item.product_images,
          price_images: item.price_images,
          position: index + 1
        }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("purchase_order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      return order;
    },
    onSuccess: () => {
      toast({ title: "Tạo đơn đặt hàng thành công!" });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi tạo đơn hàng",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      supplier_name: "",
      order_date: new Date().toISOString(),
      notes: "",
      invoice_images: [],
      invoice_amount: 0,
      discount_amount: 0
    });
    setItems([
      { product_name: "", variant: "", product_code: "", quantity: 1, unit_price: 0, selling_price: 0, total_price: 0, product_images: [], price_images: [] }
    ]);
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "quantity" || field === "unit_price") {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { product_name: "", variant: "", product_code: "", quantity: 1, unit_price: 0, selling_price: 0, total_price: 0, product_images: [], price_images: [] }]);
  };

  const copyItem = (index: number) => {
    const itemToCopy = { ...items[index] };
    // Deep copy the product_images and price_images arrays
    itemToCopy.product_images = [...itemToCopy.product_images];
    itemToCopy.price_images = [...itemToCopy.price_images];
    
    const newItems = [...items];
    newItems.splice(index + 1, 0, itemToCopy);
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      // Reset the last item to empty state instead of removing
      setItems([{ product_name: "", variant: "", product_code: "", quantity: 1, unit_price: 0, selling_price: 0, total_price: 0, product_images: [], price_images: [] }]);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
  const finalAmount = totalAmount - formData.discount_amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo đơn đặt hàng mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Nhà cung cấp *</Label>
              <Input
                id="supplier"
                placeholder="Nhập tên nhà cung cấp"
                value={formData.supplier_name}
                onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_date">Ngày đặt hàng</Label>
              <div className="flex items-center gap-2 h-10 px-3 py-2 border rounded-md bg-muted/50 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_amount">Số tiền hóa đơn (VND)</Label>
              <Input
                id="invoice_amount"
                type="text"
                inputMode="numeric"
                placeholder="Nhập số tiền VND"
                value={formData.invoice_amount || ""}
                onChange={(e) => setFormData({...formData, invoice_amount: parseNumberInput(e.target.value)})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_images">Ảnh hóa đơn</Label>
              <div className="border rounded-md p-2 min-h-[42px] bg-background">
                <ImageUploadCell
                  images={formData.invoice_images}
                  onImagesChange={(images) => setFormData({...formData, invoice_images: images})}
                  itemIndex={-1}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-medium">Danh sách sản phẩm</Label>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">STT</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Mã sản phẩm</TableHead>
                    <TableHead>Biến thể</TableHead>
                    <TableHead className="w-32">Số lượng</TableHead>
                    <TableHead className="w-40">Giá mua (VND)</TableHead>
                    <TableHead className="w-40">Giá bán (VND)</TableHead>
                    <TableHead className="w-40">Thành tiền (VND)</TableHead>
                    <TableHead className="w-32">Hình ảnh sản phẩm</TableHead>
                    <TableHead className="w-32">Hình ảnh Giá mua</TableHead>
                    <TableHead className="w-16">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Nhập tên sản phẩm"
                          value={item.product_name}
                          onChange={(e) => updateItem(index, "product_name", e.target.value)}
                          className="border-0 shadow-none focus-visible:ring-0 p-2"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Nhập mã sản phẩm"
                          value={item.product_code}
                          onChange={(e) => updateItem(index, "product_code", e.target.value)}
                          className="border-0 shadow-none focus-visible:ring-0 p-2"
                        />
                      </TableCell>
                      <TableCell>
                        <VariantSelector
                          value={item.variant}
                          onChange={(value) => updateItem(index, "variant", value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", parseNumberInput(e.target.value))}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={item.selling_price}
                          onChange={(e) => updateItem(index, "selling_price", parseNumberInput(e.target.value))}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatVND(item.total_price * 1000)}
                      </TableCell>
                      <TableCell>
                        <ImageUploadCell
                          images={item.product_images}
                          onImagesChange={(images) => updateItem(index, "product_images", images)}
                          itemIndex={index}
                        />
                      </TableCell>
                      <TableCell>
                        <ImageUploadCell
                          images={item.price_images}
                          onImagesChange={(images) => updateItem(index, "price_images", images)}
                          itemIndex={index}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            onClick={() => copyItem(index)} 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent"
                            title="Sao chép dòng"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button 
                            onClick={() => removeItem(index)} 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            title="Xóa dòng"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-center">
              <Button onClick={addItem} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Thêm sản phẩm
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Ghi chú thêm cho đơn hàng..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Tổng tiền:</span>
                <span>{formatVND(totalAmount * 1000)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="font-medium">Giảm giá:</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="w-40 text-right"
                  placeholder="0"
                  value={formData.discount_amount || ""}
                  onChange={(e) => setFormData({
                    ...formData,
                    discount_amount: parseNumberInput(e.target.value)
                  })}
                />
              </div>
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Thành tiền:</span>
                <span>{formatVND(finalAmount * 1000)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button 
              onClick={() => createOrderMutation.mutate()}
              disabled={createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? "Đang tạo..." : "Tạo đơn hàng"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}