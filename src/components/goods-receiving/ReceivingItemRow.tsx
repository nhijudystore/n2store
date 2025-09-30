import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle } from "lucide-react";

interface ReceivingItemRowProps {
  item: any;
  onQuantityChange: (itemId: string, quantity: number) => void;
}

export function ReceivingItemRow({ item, onQuantityChange }: ReceivingItemRowProps) {
  const discrepancy = item.received_quantity - item.quantity;
  const discrepancyType = discrepancy < 0 ? 'shortage' : (discrepancy > 0 ? 'overage' : 'match');
  
  const getRowClassName = () => {
    if (discrepancyType === 'shortage') return 'bg-red-50';
    if (discrepancyType === 'overage') return 'bg-green-50';
    return '';
  };

  const getDiscrepancyBadge = () => {
    if (discrepancyType === 'shortage') {
      return (
        <div className="flex items-center gap-1 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Thiếu {Math.abs(discrepancy)}</span>
        </div>
      );
    }
    if (discrepancyType === 'overage') {
      return (
        <div className="flex items-center gap-1 text-green-700">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Dư {discrepancy}</span>
        </div>
      );
    }
    return <span className="text-sm text-muted-foreground">Đủ</span>;
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
        />
      </td>
      <td className="p-3">
        {getDiscrepancyBadge()}
      </td>
    </tr>
  );
}
