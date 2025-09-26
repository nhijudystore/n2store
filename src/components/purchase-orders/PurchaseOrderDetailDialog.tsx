import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Building2, FileText, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

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
  created_at: string;
  updated_at: string;
}

interface PurchaseOrderDetailDialogProps {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseOrderDetailDialog({ order, open, onOpenChange }: PurchaseOrderDetailDialogProps) {
  if (!order) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      confirmed: "secondary", 
      received: "default",
      completed: "default",
      cancelled: "destructive"
    };

    const labels = {
      pending: "Đang chờ",
      confirmed: "Đã xác nhận", 
      received: "Đã nhận hàng",
      completed: "Hoàn thành",
      cancelled: "Đã hủy"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Chi tiết đơn hàng #{order.id.slice(-8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Nhà cung cấp</span>
              </div>
              <p className="text-base">{order.supplier_name || "Chưa cập nhật"}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Trạng thái</span>
              </div>
              <div>{getStatusBadge(order.status)}</div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Ngày đặt hàng</span>
              </div>
              <p className="text-base">
                {format(new Date(order.order_date), "dd/MM/yyyy", { locale: vi })}
              </p>
            </div>
            
            {order.invoice_date && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Ngày hóa đơn</span>
                </div>
                <p className="text-base">
                  {format(new Date(order.invoice_date), "dd/MM/yyyy", { locale: vi })}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Financial Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Thông tin tài chính</span>
            </div>
            
            <div className="grid grid-cols-1 gap-3 bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span>Tổng tiền:</span>
                <span className="font-medium">{formatCurrency(order.total_amount || 0)}</span>
              </div>
              
              {(order.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Giảm giá:</span>
                  <span className="font-medium">-{formatCurrency(order.discount_amount || 0)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-semibold">
                <span>Thành tiền:</span>
                <span className="text-primary">{formatCurrency(order.final_amount || 0)}</span>
              </div>
            </div>
          </div>

          {/* Invoice Number */}
          {order.invoice_number && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-sm font-medium">Số hóa đơn</span>
                <p className="text-base font-mono bg-muted/50 p-2 rounded">
                  {order.invoice_number}
                </p>
              </div>
            </>
          )}

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-sm font-medium">Ghi chú</span>
                <p className="text-base bg-muted/50 p-3 rounded whitespace-pre-wrap">
                  {order.notes}
                </p>
              </div>
            </>
          )}

          {/* Timestamps */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Tạo lúc:</span>
              <p>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
            </div>
            <div>
              <span className="font-medium">Cập nhật:</span>
              <p>{format(new Date(order.updated_at), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}