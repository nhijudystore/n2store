import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatVND } from "@/lib/currency-utils";
import { format } from "date-fns";
import { ArrowRight, Package, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function MobileGoodsReceivingDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const { data: orderData, isLoading } = useQuery({
    queryKey: ["mobile-goods-receiving-detail", orderId],
    queryFn: async () => {
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          items:purchase_order_items(*)
        `)
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      const { data: receiving } = await supabase
        .from("goods_receiving")
        .select(`
          *,
          items:goods_receiving_items(*)
        `)
        .eq("purchase_order_id", orderId)
        .single();

      return { ...order, receiving };
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <MobileLayout title="Chi tiết hóa đơn" showBack>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!orderData) {
    return (
      <MobileLayout title="Chi tiết hóa đơn" showBack>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Không tìm thấy đơn hàng</p>
        </div>
      </MobileLayout>
    );
  }

  const order = orderData;
  const subtotal = order.total_amount || 0;
  const discount = order.discount_amount || 0;
  const total = order.final_amount || subtotal - discount;
  const paid = order.receiving ? (total * 0.3) : 0; // Example: 30% paid
  const remaining = total - paid;

  return (
    <MobileLayout title="Chi tiết hóa đơn" showBack>
      <div className="bg-background min-h-screen">
        {/* Header with Next Button */}
        <div className="sticky top-14 bg-background border-b border-border z-30 px-4 py-2 flex items-center justify-between">
          <div className="text-sm font-medium">#{order.invoice_number || order.id.slice(0, 8)}</div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Invoice Header Section */}
        <div className="bg-background p-6 text-center space-y-3 border-b border-border">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">NHÀ CUNG CẤP</div>
            <div className="font-bold text-lg">{order.supplier_name || "N/A"}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Số hóa đơn</div>
              <div className="font-medium text-sm">{order.invoice_number || "-"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Ngày tạo</div>
              <div className="font-medium text-sm">
                {format(new Date(order.created_at), "dd/MM/yyyy")}
              </div>
            </div>
          </div>

          {order.receiving && (
            <div className="pt-2">
              <Badge variant="outline" className="border-green-500 text-green-600">
                Đã kiểm hàng - {format(new Date(order.receiving.receiving_date), "dd/MM/yyyy")}
              </Badge>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="p-4">
          <div className="bg-background rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left p-3 font-medium text-xs">STT</th>
                  <th className="text-left p-3 font-medium text-xs">Nội dung</th>
                  <th className="text-right p-3 font-medium text-xs">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item: any, index: number) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-center text-muted-foreground">{index + 1}</td>
                    <td className="p-3">
                      <div className="font-medium">{item.product_name}</div>
                      {item.variant && (
                        <div className="text-xs text-muted-foreground">{item.variant}</div>
                      )}
                      <div className="text-xs text-muted-foreground">SL: {item.quantity}</div>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatVND(item.total_price || item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Section */}
        <div className="p-4">
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tạm tính:</span>
              <span className="font-medium">{formatVND(subtotal)}</span>
            </div>
            
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Giảm giá:</span>
                <span className="font-medium text-red-600">-{formatVND(discount)}</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-base font-bold">
              <span>TỔNG CỘNG:</span>
              <span className="text-primary">{formatVND(total)}</span>
            </div>

            {order.receiving && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Đã thanh toán:</span>
                  <span className="font-medium text-green-600">{formatVND(paid)}</span>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>PHẢI THANH TOÁN:</span>
                  <span className="text-red-600">{formatVND(remaining)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="p-4">
            <div className="text-xs text-muted-foreground bg-muted/30 rounded p-3">
              <div className="font-medium mb-1">Ghi chú:</div>
              {order.notes}
            </div>
          </div>
        )}

        {/* Spacer for bottom actions */}
        <div className="h-20" />
      </div>

      {/* Bottom Actions - Fixed */}
      <div className="fixed bottom-16 left-0 right-0 bg-background border-t border-border p-4 z-40">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button variant="outline" size="sm" className="whitespace-nowrap">
            Bỏ duyệt
          </Button>
          <Button size="sm" className="whitespace-nowrap bg-primary hover:bg-primary/90">
            Thu tiền
          </Button>
          <Button variant="outline" size="sm" className="whitespace-nowrap">
            Lịch sử TT
          </Button>
          <Button variant="outline" size="sm" className="whitespace-nowrap">
            Chỉnh sửa
          </Button>
          <Button variant="destructive" size="sm" className="whitespace-nowrap">
            Xóa
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
