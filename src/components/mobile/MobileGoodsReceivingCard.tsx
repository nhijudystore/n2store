import { Package, Building, FileText, DollarSign, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatVND } from "@/lib/currency-utils";
import { format } from "date-fns";

interface MobileGoodsReceivingCardProps {
  order: any;
  onInspect: () => void;
  onViewDetail: () => void;
}

export function MobileGoodsReceivingCard({
  order,
  onInspect,
  onViewDetail,
}: MobileGoodsReceivingCardProps) {
  const getStatusBadge = () => {
    if (!order.receiving) {
      return <Badge variant="destructive">Cần kiểm</Badge>;
    }

    if (order.receiving.has_discrepancy) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Có chênh lệch</Badge>;
    }

    return <Badge variant="outline" className="border-green-500 text-green-600">Đã kiểm</Badge>;
  };

  const totalItems = order.items?.length || 0;
  const receivedAmount = order.receiving?.total_items_received || 0;

  return (
    <Card className="bg-background border border-border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="font-bold text-lg text-red-600">
          #{order.invoice_number || order.id.slice(0, 8)}
        </div>
        <div className="font-bold text-lg text-green-600">
          {formatVND(order.final_amount || order.total_amount)}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Tháng:</span>
          <span className="font-medium">
            {format(new Date(order.created_at), "MM/yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Building className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">NCC:</span>
          <span className="font-medium">{order.supplier_name || "-"}</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Sản phẩm:</span>
          <span className="font-medium">{totalItems} mặt hàng</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Ngày tạo:</span>
          <span className="font-medium">
            {format(new Date(order.created_at), "dd/MM/yyyy")}
          </span>
        </div>

        {order.receiving && (
          <div className="flex items-center gap-3 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Đã nhận:</span>
            <span className="font-medium text-green-600">
              {receivedAmount} sản phẩm
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-border">
        {getStatusBadge()}
        
        {!order.receiving ? (
          <Button
            size="sm"
            onClick={onInspect}
            className="bg-primary hover:bg-primary/90"
          >
            Kiểm hàng
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onViewDetail}
          >
            Xem chi tiết
          </Button>
        )}
      </div>
    </Card>
  );
}
