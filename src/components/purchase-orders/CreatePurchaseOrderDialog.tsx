import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Plus, X, Copy, Calendar, Warehouse } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantSelector } from "./VariantSelector";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { detectAttributesFromText } from "@/lib/tpos-api";
import { generateProductCode } from "@/lib/product-code-generator";

interface PurchaseOrderItem {
  product_name: string;
  variant: string;
  product_code: string;
  quantity: number;
  unit_price: number | string;
  selling_price: number | string;
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
    { product_name: "", variant: "", product_code: "", quantity: 1, unit_price: "", selling_price: "", total_price: 0, product_images: [], price_images: [] }
  ]);

  const [isSelectProductOpen, setIsSelectProductOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);


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
          unit_price: Number(item.unit_price || 0) * 1000,
          selling_price: Number(item.selling_price || 0) * 1000,
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

        // Upsert products to inventory
        for (const item of items.filter(item => item.product_name.trim() && item.product_code.trim())) {
          const { error: productError } = await supabase
            .from("products")
            .upsert({
              product_code: item.product_code,
              product_name: item.product_name,
              variant: item.variant || null,
              purchase_price: Number(item.unit_price || 0) * 1000,
              selling_price: Number(item.selling_price || 0) * 1000,
              supplier_name: formData.supplier_name,
              product_images: item.product_images.length > 0 ? item.product_images : null,
              price_images: item.price_images.length > 0 ? item.price_images : null,
              stock_quantity: 0, // Initialize with 0, will be updated on goods receiving
              unit: 'Cái'
            }, {
              onConflict: 'product_code,variant',
              ignoreDuplicates: false
            });

          if (productError) {
            console.error('Error upserting product:', productError);
            // Don't throw error, just log it - we don't want to fail the whole order
          }
        }
      }

      return order;
    },
    onSuccess: () => {
      toast({ title: "Tạo đơn đặt hàng thành công!" });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
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
      { product_name: "", variant: "", product_code: "", quantity: 1, unit_price: "", selling_price: "", total_price: 0, product_images: [], price_images: [] }
    ]);
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "quantity" || field === "unit_price") {
      newItems[index].total_price = newItems[index].quantity * Number(newItems[index].unit_price || 0);
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { product_name: "", variant: "", product_code: "", quantity: 1, unit_price: "", selling_price: "", total_price: 0, product_images: [], price_images: [] }]);
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
      setItems([{ product_name: "", variant: "", product_code: "", quantity: 1, unit_price: "", selling_price: "", total_price: 0, product_images: [], price_images: [] }]);
    }
  };

  const handleSelectProduct = (product: any) => {
    if (currentItemIndex !== null) {
      const newItems = [...items];
      newItems[currentItemIndex] = {
        ...newItems[currentItemIndex],
        product_name: product.product_name,
        product_code: product.product_code,
        variant: product.variant || "",
        unit_price: product.purchase_price / 1000,
        selling_price: product.selling_price / 1000,
        product_images: product.product_images || [],
        price_images: product.price_images || [],
        total_price: newItems[currentItemIndex].quantity * (product.purchase_price / 1000)
      };
      setItems(newItems);
      
      // Auto-fill supplier name if empty
      if (!formData.supplier_name && product.supplier_name) {
        setFormData({ ...formData, supplier_name: product.supplier_name });
      }
    }
    setCurrentItemIndex(null);
  };

  const openSelectProduct = (index: number) => {
    setCurrentItemIndex(index);
    setIsSelectProductOpen(true);
  };

  const handleProductNameBlur = async (index: number, productName: string) => {
    if (!productName.trim()) return;
    
    // Generate product code if empty
    if (!items[index].product_code.trim()) {
      try {
        const code = await generateProductCode(productName);
        updateItem(index, "product_code", code);
        toast({
          title: "Đã tạo mã SP",
          description: `Mã SP: ${code}`,
        });
      } catch (error) {
        console.error("Error generating product code:", error);
      }
    }
    
    const detected = detectAttributesFromText(productName);
    
    // Build variant string from detected attributes
    const variantParts: string[] = [];
    if (detected.sizeText && detected.sizeText.length > 0) {
      variantParts.push(...detected.sizeText);
    }
    if (detected.color && detected.color.length > 0) {
      variantParts.push(...detected.color);
    }
    if (detected.sizeNumber && detected.sizeNumber.length > 0) {
      variantParts.push(...detected.sizeNumber);
    }
    
    if (variantParts.length > 0) {
      const detectedVariant = variantParts.join(" - ");
      // Only update if variant is empty
      if (!items[index].variant.trim()) {
        updateItem(index, "variant", detectedVariant);
        toast({
          title: "Tự động phát hiện biến thể",
          description: `Đã điền: ${detectedVariant}`,
        });
      }
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.order_date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.order_date ? format(new Date(formData.order_date), "dd/MM/yyyy") : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.order_date ? new Date(formData.order_date) : undefined}
                    onSelect={(date) => setFormData({...formData, order_date: date ? date.toISOString() : new Date().toISOString()})}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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
            <div className="flex items-center justify-between">
              <Label className="text-lg font-medium">Danh sách sản phẩm</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openSelectProduct(items.length > 0 && items[items.length - 1].product_name ? items.length : items.length - 1)}
              >
                <Warehouse className="h-4 w-4 mr-2" />
                Chọn từ Kho SP
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">STT</TableHead>
              <TableHead className="w-[260px]">Tên sản phẩm</TableHead>
              <TableHead className="w-[70px]">Mã sản phẩm</TableHead>
              <TableHead className="w-[150px]">Biến thể</TableHead>
              <TableHead className="w-[60px]">SL</TableHead>
              <TableHead className="w-[90px]">Giá mua (VND)</TableHead>
              <TableHead className="w-[90px]">Giá bán (VND)</TableHead>
              <TableHead className="w-[130px]">Thành tiền (VND)</TableHead>
              <TableHead className="w-[100px]">Hình ảnh sản phẩm</TableHead>
              <TableHead className="w-[100px]">Hình ảnh Giá mua</TableHead>
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
                        <Textarea
                          placeholder="Nhập tên sản phẩm"
                          value={item.product_name}
                          onChange={(e) => updateItem(index, "product_name", e.target.value)}
                          onBlur={(e) => handleProductNameBlur(index, e.target.value)}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 min-h-[60px] resize-none"
                          rows={2}
                        />
                      </TableCell>
            <TableCell>
              <Input
                placeholder="Mã SP"
                value={item.product_code}
                onChange={(e) => updateItem(index, "product_code", e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 p-2 w-[70px] text-xs"
                maxLength={10}
              />
            </TableCell>
            <TableCell>
              <VariantSelector
                value={item.variant}
                onChange={(value) => updateItem(index, "variant", value)}
                className="w-[150px]"
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
                          placeholder=""
                          value={item.unit_price === 0 || item.unit_price === "" ? "" : item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", parseNumberInput(e.target.value))}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-right w-[90px] text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder=""
                          value={item.selling_price === 0 || item.selling_price === "" ? "" : item.selling_price}
                          onChange={(e) => updateItem(index, "selling_price", parseNumberInput(e.target.value))}
                          className="border-0 shadow-none focus-visible:ring-0 p-2 text-right w-[90px] text-sm"
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
                            onClick={() => openSelectProduct(index)} 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                            title="Chọn từ kho"
                          >
                            <Warehouse className="w-4 h-4" />
                          </Button>
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

      <SelectProductDialog
        open={isSelectProductOpen}
        onOpenChange={setIsSelectProductOpen}
        onSelect={handleSelectProduct}
      />
    </Dialog>
  );
}