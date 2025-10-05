import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Plus, X, Copy, Calendar, Warehouse, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadCell } from "./ImageUploadCell";
import { VariantSelector } from "./VariantSelector";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { generateProductCodeFromMax, incrementProductCode } from "@/lib/product-code-generator";
import { useDebounce } from "@/hooks/use-debounce";
import { detectVariantsFromText } from "@/lib/variant-detector";

interface PurchaseOrderItem {
  id?: string;
  product_name: string;
  product_code: string;
  variant: string;
  quantity: number;
  unit_price: number | string;
  selling_price: number | string;
  total_price: number;
  notes: string;
  product_images: string[];
  price_images: string[];
  position?: number;
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
  notes: string | null;
  invoice_images: string[] | null;
  created_at: string;
  updated_at: string;
}

interface EditPurchaseOrderDialogProps {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPurchaseOrderDialog({ order, open, onOpenChange }: EditPurchaseOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper function to parse number input from text
  const parseNumberInput = (value: string): number => {
    const numericValue = value.replace(/[^\d]/g, '');
    return numericValue === '' ? 0 : parseInt(numericValue, 10);
  };

  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceImages, setInvoiceImages] = useState<string[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    { product_name: "", variant: "", product_code: "", quantity: 1, unit_price: "", selling_price: "", total_price: 0, product_images: [], price_images: [], notes: "" }
  ]);
  const [isSelectProductOpen, setIsSelectProductOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Debounce product names for auto-generating codes
  const debouncedProductNames = useDebounce(
    items.map(i => i.product_name).join('|'),
    500
  );

  // Auto-generate product code when product name changes (with debounce)
  useEffect(() => {
    items.forEach(async (item, index) => {
      if (item.product_name.trim() && !item.product_code.trim()) {
        try {
          const code = await generateProductCodeFromMax(item.product_name, items);
          setItems(prev => {
            const newItems = [...prev];
            if (newItems[index] && !newItems[index].product_code.trim()) {
              newItems[index] = { ...newItems[index], product_code: code };
            }
            return newItems;
          });
        } catch (error) {
          console.error("Error generating product code:", error);
        }
      }
    });
  }, [debouncedProductNames]);

  // Fetch existing items when order changes
  const { data: existingItems } = useQuery({
    queryKey: ["purchaseOrderItems", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", order.id)
        .order("position", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!order?.id && open,
  });

  // Load order data when dialog opens
  useEffect(() => {
    if (order && open) {
      setSupplierName(order.supplier_name || "");
      setOrderDate(order.order_date || new Date().toISOString());
      setInvoiceNumber(order.invoice_number || "");
      setNotes(order.notes || "");
      setInvoiceImages(order.invoice_images || []);
      setInvoiceAmount(order.total_amount ? order.total_amount / 1000 : 0);
      setDiscountAmount(order.discount_amount ? order.discount_amount / 1000 : 0);
    }
  }, [order, open]);

  // Load items when existingItems change
  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems.map(item => ({
        id: item.id,
        product_name: item.product_name || "",
        product_code: item.product_code || "",
        variant: item.variant || "",
        quantity: item.quantity || 1,
        unit_price: Number(item.unit_price) / 1000 || 0,
        selling_price: Number(item.selling_price) / 1000 || 0,
        total_price: Number(item.total_price) / 1000 || 0,
        notes: item.notes || "",
        product_images: item.product_images || [],
        price_images: item.price_images || [],
      })));
    } else if (open && existingItems) {
      // If no existing items, add one empty row
      setItems([{
        product_name: "",
        product_code: "",
        variant: "",
        quantity: 1,
        unit_price: "",
        selling_price: "",
        total_price: 0,
        notes: "",
        product_images: [],
        price_images: [],
      }]);
    }
  }, [existingItems, open]);

  const resetForm = () => {
    setSupplierName("");
    setOrderDate(new Date().toISOString());
    setInvoiceNumber("");
    setNotes("");
    setInvoiceImages([]);
    setInvoiceAmount(0);
    setDiscountAmount(0);
    setItems([{
      product_name: "",
      product_code: "",
      variant: "",
      quantity: 1,
      unit_price: "",
      selling_price: "",
      total_price: 0,
      notes: "",
      product_images: [],
      price_images: [],
    }]);
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = field === 'quantity' ? value : newItems[index].quantity;
      const price = field === 'unit_price' ? value : newItems[index].unit_price;
      newItems[index].total_price = qty * Number(price || 0);
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      product_name: "",
      product_code: "",
      variant: "",
      quantity: 1,
      unit_price: "",
      selling_price: "",
      total_price: 0,
      notes: "",
      product_images: [],
      price_images: [],
    }]);
  };

  const copyItem = (index: number) => {
    const itemToCopy = { ...items[index] };
    delete itemToCopy.id; // Remove id so it will be inserted as new
    // Deep copy the product_images and price_images arrays
    itemToCopy.product_images = [...itemToCopy.product_images];
    itemToCopy.price_images = [...itemToCopy.price_images];
    
    // Auto-increment product code if it exists
    if (itemToCopy.product_code.trim()) {
      const existingCodes = items.map(item => item.product_code);
      const newCode = incrementProductCode(itemToCopy.product_code, existingCodes);
      if (newCode) {
        itemToCopy.product_code = newCode;
        toast({
          title: "Đã sao chép và tăng mã SP",
          description: `Mã mới: ${newCode}`,
        });
      }
    }
    
    const newItems = [...items];
    newItems.splice(index + 1, 0, itemToCopy);
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      // Reset the last item to empty state instead of removing
      setItems([{ product_name: "", variant: "", product_code: "", quantity: 1, unit_price: "", selling_price: "", total_price: 0, product_images: [], price_images: [], notes: "" }]);
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
      if (!supplierName && product.supplier_name) {
        setSupplierName(product.supplier_name);
      }
    }
    setCurrentItemIndex(null);
  };

  const openSelectProduct = (index: number) => {
    setCurrentItemIndex(index);
    setIsSelectProductOpen(true);
  };

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order?.id) throw new Error("Order ID is required");
      if (!supplierName.trim()) {
        throw new Error("Vui lòng nhập tên nhà cung cấp");
      }

      const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0) * 1000;
      const finalAmount = totalAmount - (discountAmount * 1000);

      // Update purchase order
      const { error: orderError } = await supabase
        .from("purchase_orders")
        .update({
          order_date: orderDate,
          supplier_name: supplierName,
          invoice_number: invoiceNumber || null,
          notes: notes || null,
          invoice_images: invoiceImages.length > 0 ? invoiceImages : null,
          total_amount: totalAmount,
          discount_amount: discountAmount * 1000,
          final_amount: finalAmount,
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // Get IDs of items to delete (items that existed but are no longer in the list)
      const existingItemIds = existingItems?.map(item => item.id) || [];
      const currentItemIds = items.filter(item => item.id).map(item => item.id);
      const deletedItemIds = existingItemIds.filter(id => !currentItemIds.includes(id));

      // Delete removed items
      if (deletedItemIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("purchase_order_items")
          .delete()
          .in("id", deletedItemIds);

        if (deleteError) throw deleteError;
      }

      // Get max position for new items
      const { data: maxPosData } = await supabase
        .from("purchase_order_items")
        .select("position")
        .eq("purchase_order_id", order.id)
        .order("position", { ascending: false })
        .limit(1);
      
      const maxPosition = maxPosData?.[0]?.position || 0;
      let nextPosition = maxPosition + 1;

      // Update existing items and insert new items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemData = {
          purchase_order_id: order.id,
          product_name: item.product_name,
          product_code: item.product_code || null,
          variant: item.variant || null,
          quantity: item.quantity,
          unit_price: Number(item.unit_price || 0) * 1000,
          selling_price: Number(item.selling_price || 0) * 1000,
          total_price: item.total_price * 1000,
          notes: item.notes || null,
          product_images: item.product_images.length > 0 ? item.product_images : null,
          price_images: item.price_images.length > 0 ? item.price_images : null,
        };

        if (item.id) {
          // Update existing item - preserve position
          const { error: updateError } = await supabase
            .from("purchase_order_items")
            .update(itemData)
            .eq("id", item.id);

          if (updateError) throw updateError;
        } else {
          // Insert new item - assign next position
          const { error: insertError } = await supabase
            .from("purchase_order_items")
            .insert({ ...itemData, position: nextPosition });

          if (insertError) throw insertError;
          nextPosition++;
        }
      }

      return order.id;
    },
    onSuccess: () => {
      // Optimistic update: Update only the edited order in cache
      queryClient.setQueryData(["purchase-orders"], (oldData: any) => {
        if (!oldData || !order?.id) return oldData;
        
        return oldData.map((po: any) => {
          if (po.id === order.id) {
            // Calculate new totals (multiply by 1000 to match database VND units)
            const totalAmount = items.reduce((sum, item) => {
              return sum + (Number(item.quantity) * Number(item.unit_price) * 1000);
            }, 0);
            const finalAmount = totalAmount - (Number(discountAmount) * 1000);
            
            // Sort items by position for consistent display
            const sortedItems = [...items].sort((a, b) => {
              const posA = a.position || 999999;
              const posB = b.position || 999999;
              return posA - posB;
            });
            
            return {
              ...po,
              supplier_name: supplierName,
              order_date: orderDate,
              invoice_number: invoiceNumber,
              notes,
              invoice_images: invoiceImages,
              discount_amount: Number(discountAmount) * 1000,
              total_amount: totalAmount,
              final_amount: finalAmount,
              items: sortedItems.map(item => ({
                ...item,
                purchase_order_id: order.id,
                unit_price: Number(item.unit_price) * 1000,
                selling_price: Number(item.selling_price) * 1000,
                total_price: Number(item.quantity) * Number(item.unit_price) * 1000
              }))
            };
          }
          return po;
        });
      });
      
      // Invalidate stats and products queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
      
      toast({
        title: "Cập nhật đơn hàng thành công!",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi cập nhật đơn hàng",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    updateOrderMutation.mutate();
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
  const finalAmount = totalAmount - discountAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pr-10">
          <DialogTitle>Chỉnh sửa đơn hàng #{order?.invoice_number || order?.id.slice(0, 8)}</DialogTitle>
          <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 border border-destructive/30 hover:border-destructive/50">
                <RotateCcw className="w-4 h-4" />
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa toàn bộ dữ liệu?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc muốn xóa toàn bộ dữ liệu đã nhập? Hành động này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  resetForm();
                  setShowClearConfirm(false);
                }}>
                  Xóa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Nhà cung cấp *</Label>
              <Input
                id="supplier"
                placeholder="Nhập tên nhà cung cấp"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
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
                      !orderDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {orderDate ? format(new Date(orderDate), "dd/MM/yyyy") : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={orderDate ? new Date(orderDate) : undefined}
                    onSelect={(date) => setOrderDate(date ? date.toISOString() : new Date().toISOString())}
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
                value={invoiceAmount || ""}
                onChange={(e) => setInvoiceAmount(parseNumberInput(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_images">Ảnh hóa đơn</Label>
              <div className="border rounded-md p-2 min-h-[42px] bg-background">
                <ImageUploadCell
                  images={invoiceImages}
                  onImagesChange={setInvoiceImages}
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
                          onBlur={() => {
                            // Auto-detect variants on blur
                            const result = detectVariantsFromText(item.product_name);
                            if (result.colors.length > 0 || result.sizeText.length > 0) {
                              const detectedVariant = [
                                ...result.colors.map(c => c.value),
                                ...result.sizeText.map(s => s.value)
                              ].join(" ");
                              if (detectedVariant && !item.variant) {
                                updateItem(index, "variant", detectedVariant);
                              }
                            }
                          }}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(parseNumberInput(e.target.value))}
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
              onClick={handleSubmit}
              disabled={updateOrderMutation.isPending}
            >
              {updateOrderMutation.isPending ? "Đang cập nhật..." : "Cập nhật đơn hàng"}
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
