import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Package, AlertCircle, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { ReceivingItemRow } from "./ReceivingItemRow";

interface CreateReceivingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onSuccess: () => void;
}

type Step = "confirm" | "inspect";

export function CreateReceivingDialog({ open, onOpenChange, order, onSuccess }: CreateReceivingDialogProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && order) {
      setStep(order.hasReceiving ? "inspect" : "confirm");
      setItems(order.items?.map((item: any) => ({
        ...item,
        received_quantity: item.quantity,
        item_notes: ""
      })) || []);
      setNotes("");
    }
  }, [open, order]);

  const calculateDiscrepancy = (expected: number, received: number) => {
    const diff = received - expected;
    
    return {
      quantity: diff,
      type: diff < 0 ? 'shortage' : (diff > 0 ? 'overage' : 'match'),
      className: diff < 0 ? 'bg-red-50 text-red-700' : 
                 (diff > 0 ? 'bg-green-50 text-green-700' : ''),
      icon: diff < 0 ? AlertCircle : (diff > 0 ? CheckCircle : null),
      label: diff < 0 ? `Thiếu ${Math.abs(diff)}` : 
             (diff > 0 ? `Dư ${diff}` : 'Đủ')
    };
  };

  const handleQuantityChange = (itemId: string, receivedQty: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, received_quantity: receivedQty }
        : item
    ));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thực hiện kiểm hàng");
      return;
    }

    // Get username from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      toast.error("Không tìm thấy thông tin người dùng");
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate totals
      const totalExpected = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalReceived = items.reduce((sum, item) => sum + item.received_quantity, 0);
      const hasDiscrepancy = items.some(item => item.quantity !== item.received_quantity);

      // 1. Insert goods_receiving
      const { data: receiving, error: receivingError } = await supabase
        .from('goods_receiving')
        .insert({
          purchase_order_id: order.id,
          received_by_user_id: user.id,
          received_by_username: profile.username,
          total_items_expected: totalExpected,
          total_items_received: totalReceived,
          has_discrepancy: hasDiscrepancy,
          notes: notes
        })
        .select()
        .single();

      if (receivingError) throw receivingError;

      // 2. Insert goods_receiving_items
      const itemsToInsert = items.map(item => {
        const discrepancy = calculateDiscrepancy(item.quantity, item.received_quantity);
        
        return {
          goods_receiving_id: receiving.id,
          purchase_order_item_id: item.id,
          product_name: item.product_name,
          product_code: item.product_code,
          variant: item.variant,
          expected_quantity: item.quantity,
          received_quantity: item.received_quantity,
          discrepancy_type: discrepancy.type,
          discrepancy_quantity: discrepancy.quantity,
          product_condition: 'good',
          item_notes: item.item_notes
        };
      });

      const { error: itemsError } = await supabase
        .from('goods_receiving_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Update purchase_order status
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'received' })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['goods-receiving-orders'] });
      queryClient.invalidateQueries({ queryKey: ['goods-receiving-stats'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });

      toast.success("Kiểm hàng thành công!");
      onSuccess();

    } catch (error: any) {
      console.error('Error submitting receiving:', error);
      toast.error(error.message || "Có lỗi xảy ra khi kiểm hàng");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  const totalExpected = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.received_quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {step === "confirm" ? "Xác nhận đơn hàng" : "Kiểm hàng chi tiết"}
          </DialogTitle>
          <DialogDescription>
            {step === "confirm" 
              ? "Xem lại thông tin đơn hàng trước khi kiểm"
              : "Nhập số lượng thực nhận cho từng sản phẩm"
            }
          </DialogDescription>
        </DialogHeader>

        {step === "confirm" ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nhà cung cấp:</span>
                <span className="font-medium">{order.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ngày đặt:</span>
                <span className="font-medium">
                  {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: vi })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số hóa đơn:</span>
                <span className="font-medium">{order.invoice_number || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng sản phẩm:</span>
                <span className="font-medium">{order.items?.length || 0} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng số lượng:</span>
                <span className="font-medium">{totalExpected} cái</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng tiền:</span>
                <span className="font-medium text-lg">{order.final_amount?.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button onClick={() => setStep("inspect")}>
                Tiếp tục <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 flex justify-between items-center">
              <div className="text-sm">
                <span className="text-muted-foreground">Tổng đặt:</span>
                <span className="font-medium ml-2">{totalExpected}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Tổng nhận:</span>
                <span className="font-medium ml-2">{totalReceived}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Chênh lệch:</span>
                <span className={`font-medium ml-2 ${
                  totalReceived < totalExpected ? 'text-red-600' :
                  totalReceived > totalExpected ? 'text-green-600' : ''
                }`}>
                  {totalReceived - totalExpected > 0 ? '+' : ''}{totalReceived - totalExpected}
                </span>
              </div>
            </div>

            {/* Items table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Sản phẩm</th>
                      <th className="text-left p-3 text-sm font-medium">Mã SP</th>
                      <th className="text-left p-3 text-sm font-medium">Biến thể</th>
                      <th className="text-center p-3 text-sm font-medium">SL Đặt</th>
                      <th className="text-center p-3 text-sm font-medium">SL Nhận</th>
                      <th className="text-left p-3 text-sm font-medium">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <ReceivingItemRow
                        key={item.id}
                        item={item}
                        onQuantityChange={handleQuantityChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-2 block">Ghi chú chung</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập ghi chú về tình trạng hàng hóa..."
                rows={3}
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("confirm")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Đang xử lý..." : "Hoàn thành kiểm hàng"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
