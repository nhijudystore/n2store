import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";

interface ReceivingItemRowProps {
  item: any;
  onQuantityChange: (itemId: string, quantity: number) => void;
  isConfirmed: boolean;
  onConfirm: (itemId: string) => void;
}

export function ReceivingItemRow({ item, onQuantityChange, isConfirmed, onConfirm }: ReceivingItemRowProps) {
  const getRowClassName = () => {
    if (isConfirmed) return 'bg-green-50/50';
    return '';
  };

  const getInputClassName = () => {
    if (isConfirmed) return "w-24 text-center mx-auto";
    
    if (item.received_quantity < item.quantity) {
      return "w-24 text-center mx-auto bg-red-50 border-red-300 text-red-700 focus-visible:ring-red-500";
    } else if (item.received_quantity > item.quantity) {
      return "w-24 text-center mx-auto bg-orange-50 border-orange-300 text-orange-700 focus-visible:ring-orange-500";
    }
    return "w-24 text-center mx-auto";
  };

  const getConfirmationDisplay = () => {
    if (!isConfirmed) {
      return (
        <Button 
          size="sm" 
          onClick={() => onConfirm(item.id)}
          className="min-h-[44px]"
        >
          Xác nhận
        </Button>
      );
    }

    const diff = item.received_quantity - item.quantity;
    
    if (diff < 0) {
      return (
        <div className="flex items-center justify-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Thiếu {Math.abs(diff)}</span>
        </div>
      );
    } else if (diff > 0) {
      return (
        <div className="flex items-center justify-center gap-2 text-orange-600">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">Dư {diff}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Đủ hàng</span>
        </div>
      );
    }
  };

  return (
    <tr className={getRowClassName()}>
      <td className="p-3">
        <div className="font-medium">{item.product_name}</div>
      </td>
      <td className="p-3 text-sm text-muted-foreground">
        {item.product_code || '-'}
      </td>
      <td className="p-3 text-sm text-muted-foreground">
        {item.variant || '-'}
      </td>
      <td className="p-3 text-center">
        <span className="font-medium">{item.quantity}</span>
      </td>
      <td className="p-3">
        <Input
          type="number"
          min="0"
          value={item.received_quantity}
          onChange={(e) => onQuantityChange(item.id, parseInt(e.target.value) || 0)}
          className={getInputClassName()}
          disabled={isConfirmed}
        />
      </td>
      <td className="p-3 text-center">
        {getConfirmationDisplay()}
      </td>
    </tr>
  );
}
