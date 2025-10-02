import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, Calendar } from "lucide-react";
import { ImageUploadCell } from "./ImageUploadCell";
import { format } from "date-fns";
import { formatVND } from "@/lib/currency-utils";

interface PurchaseOrderItem {
  id?: string;
  product_name: string;
  product_code: string;
  variant: string;
  description: string;
  quantity: number;
  unit_price: number;
  selling_price: number;
  total_price: number;
  notes: string;
  product_images: string[];
  price_images: string[];
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
  invoice_date: string | null;
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
  const queryClient = useQueryClient();

  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString());
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceImages, setInvoiceImages] = useState<string[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);

  // Fetch existing items when order changes
  const { data: existingItems } = useQuery({
    queryKey: ["purchaseOrderItems", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", order.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!order?.id && open,
  });

  // Load order data when dialog opens
  useEffect(() => {
    if (order && open) {
      setSupplierName(order.supplier_name || "");
      setOrderDate(order.order_date || new Date().toISOString().split('T')[0]);
      setInvoiceDate(order.invoice_date || "");
      setInvoiceNumber(order.invoice_number || "");
      setNotes(order.notes || "");
      setInvoiceImages(order.invoice_images || []);
      setDiscountAmount(order.discount_amount / 1000 || 0);
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
        description: item.description || "",
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
        description: "",
        quantity: 1,
        unit_price: 0,
        selling_price: 0,
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
    setInvoiceDate("");
    setInvoiceNumber("");
    setNotes("");
    setInvoiceImages([]);
    setDiscountAmount(0);
    setItems([{
      product_name: "",
      product_code: "",
      variant: "",
      description: "",
      quantity: 1,
      unit_price: 0,
      selling_price: 0,
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
      newItems[index].total_price = qty * price;
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      product_name: "",
      product_code: "",
      variant: "",
      description: "",
      quantity: 1,
      unit_price: 0,
      selling_price: 0,
      total_price: 0,
      notes: "",
      product_images: [],
      price_images: [],
    }]);
  };

  const copyItem = (index: number) => {
    const itemToCopy = { ...items[index] };
    delete itemToCopy.id; // Remove id so it will be inserted as new
    setItems([...items, itemToCopy]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
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
          supplier_name: supplierName,
          invoice_date: invoiceDate || null,
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

      // Update existing items and insert new items
      for (const item of items) {
        const itemData = {
          purchase_order_id: order.id,
          product_name: item.product_name,
          product_code: item.product_code || null,
          variant: item.variant || null,
          description: item.description || null,
          quantity: item.quantity,
          unit_price: item.unit_price * 1000,
          selling_price: item.selling_price * 1000,
          total_price: item.total_price * 1000,
          notes: item.notes || null,
          product_images: item.product_images.length > 0 ? item.product_images : null,
          price_images: item.price_images.length > 0 ? item.price_images : null,
        };

        if (item.id) {
          // Update existing item
          const { error: updateError } = await supabase
            .from("purchase_order_items")
            .update(itemData)
            .eq("id", item.id);

          if (updateError) throw updateError;
        } else {
          // Insert new item
          const { error: insertError } = await supabase
            .from("purchase_order_items")
            .insert(itemData);

          if (insertError) throw insertError;
        }
      }

      return order.id;
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đơn hàng đã được cập nhật",
      });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-stats"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrderItems", order?.id] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    updateOrderMutation.mutate();
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
  const finalAmount = totalAmount - discountAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa đơn hàng #{order?.invoice_number || order?.id.slice(0, 8)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Nhà cung cấp *</Label>
              <Input
                id="supplier"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nhập tên nhà cung cấp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderDate">Ngày đặt hàng</Label>
              <div className="flex items-center gap-2 h-10 px-3 py-2 border rounded-md bg-muted/50 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{order?.order_date ? format(new Date(order.order_date), "dd/MM/yyyy HH:mm") : "Không xác định"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Ngày hóa đơn</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Số hóa đơn</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Nhập số hóa đơn"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountAmount">Số tiền giảm giá (VND)</Label>
              <Input
                id="discountAmount"
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceImages">Ảnh hóa đơn</Label>
            <ImageUploadCell
              images={invoiceImages}
              onImagesChange={setInvoiceImages}
              itemIndex={-1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nhập ghi chú (không bắt buộc)"
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Danh sách sản phẩm</Label>
              <Button onClick={addItem} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Thêm sản phẩm
              </Button>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left min-w-[150px]">Tên sản phẩm</th>
                    <th className="p-2 text-left min-w-[100px]">Mã SP</th>
                    <th className="p-2 text-left min-w-[100px]">Phân loại</th>
                    <th className="p-2 text-left min-w-[150px]">Mô tả</th>
                    <th className="p-2 text-left min-w-[80px]">SL</th>
                    <th className="p-2 text-left min-w-[100px]">Đơn giá (VND)</th>
                    <th className="p-2 text-left min-w-[100px]">Giá bán (VND)</th>
                    <th className="p-2 text-left min-w-[100px]">Thành tiền (VND)</th>
                    <th className="p-2 text-left min-w-[150px]">Ảnh SP</th>
                    <th className="p-2 text-left min-w-[150px]">Ảnh giá</th>
                    <th className="p-2 text-left min-w-[150px]">Ghi chú</th>
                    <th className="p-2 text-center min-w-[100px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">
                        <Input
                          value={item.product_name}
                          onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                          placeholder="Tên sản phẩm"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.product_code}
                          onChange={(e) => updateItem(index, 'product_code', e.target.value)}
                          placeholder="Mã"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.variant}
                          onChange={(e) => updateItem(index, 'variant', e.target.value)}
                          placeholder="Phân loại"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Mô tả"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          min="1"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                          min="0"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.selling_price}
                          onChange={(e) => updateItem(index, 'selling_price', Number(e.target.value))}
                          min="0"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.total_price}
                          readOnly
                          className="bg-muted"
                        />
                      </td>
                      <td className="p-2">
                        <ImageUploadCell
                          images={item.product_images}
                          onImagesChange={(images) => updateItem(index, 'product_images', images)}
                          itemIndex={index}
                        />
                      </td>
                      <td className="p-2">
                        <ImageUploadCell
                          images={item.price_images}
                          onImagesChange={(images) => updateItem(index, 'price_images', images)}
                          itemIndex={index}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.notes}
                          onChange={(e) => updateItem(index, 'notes', e.target.value)}
                          placeholder="Ghi chú"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyItem(index)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                            disabled={items.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <div className="flex gap-4">
                <span className="font-medium">Tổng tiền:</span>
                <span>{formatVND(totalAmount * 1000)}</span>
              </div>
              <div className="flex gap-4">
                <span className="font-medium">Giảm giá:</span>
                <span>{formatVND(discountAmount * 1000)}</span>
              </div>
              <div className="flex gap-4 text-lg font-bold">
                <span>Thành tiền:</span>
                <span>{formatVND(finalAmount * 1000)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={updateOrderMutation.isPending}>
              {updateOrderMutation.isPending ? "Đang cập nhật..." : "Cập nhật đơn hàng"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
