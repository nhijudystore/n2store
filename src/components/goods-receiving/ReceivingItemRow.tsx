import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

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
          className="w-24 text-center mx-auto"
          disabled={isConfirmed}
        />
      </td>
      <td className="p-3 text-center">
        {isConfirmed ? (
          <div className="flex items-center justify-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Đã xác nhận</span>
          </div>
        ) : (
          <Button 
            size="sm" 
            onClick={() => onConfirm(item.id)}
            className="min-h-[44px]"
          >
            Xác nhận
          </Button>
        )}
      </td>
    </tr>
  );
}
