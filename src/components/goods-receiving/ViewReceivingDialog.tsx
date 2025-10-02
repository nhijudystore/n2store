import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { Eye, AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";

interface ViewReceivingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}

export function ViewReceivingDialog({ open, onOpenChange, orderId }: ViewReceivingDialogProps) {
  const [receivingData, setReceivingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      fetchReceivingData();
    }
  }, [open, orderId]);

  const fetchReceivingData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('goods_receiving')
        .select(`
          *,
          items:goods_receiving_items(*)
        `)
        .eq('purchase_order_id', orderId)
        .single();

      if (error) throw error;
      setReceivingData(data);
    } catch (error) {
      console.error('Error fetching receiving data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRowClassName = (item: any) => {
    const diff = item.received_quantity - item.expected_quantity;
    
    if (diff < 0) {
      return "border-t bg-red-50/70 hover:bg-red-50";
    } else if (diff > 0) {
      return "border-t bg-orange-50/70 hover:bg-orange-50";
    } else {
      return "border-t bg-green-50/70 hover:bg-green-50";
    }
  };

  const getStatusDisplay = (item: any) => {
    const diff = item.received_quantity - item.expected_quantity;
    
    if (diff < 0) {
      return (
        <div className="flex items-center justify-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Thiếu {Math.abs(diff)}</span>
        </div>
      );
    } else if (diff > 0) {
      return (
        <div className="flex items-center justify-center gap-2 text-orange-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Dư {diff}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center gap-2 text-green-700">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Đủ hàng</span>
        </div>
      );
    }
  };

  if (!receivingData && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Kết quả kiểm hàng
          </DialogTitle>
          <DialogDescription>
            Xem chi tiết kết quả kiểm hàng đã hoàn thành
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Đang tải dữ liệu...
          </div>
        ) : receivingData ? (
          <div className="space-y-4">
            {/* Info */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Ngày kiểm:</span>
                  <span className="font-medium ml-2">
                    {format(new Date(receivingData.receiving_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Người kiểm:</span>
                  <span className="font-medium ml-2">{receivingData.received_by_username}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t">
                <div className="text-sm">
                  <span className="text-muted-foreground">Tổng đặt:</span>
                  <span className="font-medium ml-2">{receivingData.total_items_expected}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Tổng nhận:</span>
                  <span className="font-medium ml-2">{receivingData.total_items_received}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <Badge 
                    variant="secondary" 
                    className={
                      receivingData.has_discrepancy 
                        ? "bg-orange-50 text-orange-700 border-orange-200 ml-2" 
                        : "bg-green-50 text-green-700 border-green-200 ml-2"
                    }
                  >
                    {receivingData.has_discrepancy ? "Có chênh lệch" : "Đầy đủ"}
                  </Badge>
                </div>
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
                      <th className="text-center p-3 text-sm font-medium w-32">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivingData.items?.map((item: any) => (
                      <tr key={item.id} className={getRowClassName(item)}>
                        <td className="p-3 text-sm">{item.product_name}</td>
                        <td className="p-3 text-sm">{item.product_code || '-'}</td>
                        <td className="p-3 text-sm">{item.variant || '-'}</td>
                        <td className="p-3 text-sm text-center font-medium">{item.expected_quantity}</td>
                        <td className="p-3 text-sm text-center font-medium">{item.received_quantity}</td>
                        <td className="p-3 text-center">
                          {getStatusDisplay(item)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {receivingData.notes && (
              <div className="bg-muted/30 rounded-lg p-4">
                <label className="text-sm font-medium mb-2 block">Ghi chú</label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {receivingData.notes}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
