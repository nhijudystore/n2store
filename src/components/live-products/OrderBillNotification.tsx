import React from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface OrderBillProps {
  sessionIndex: string;
  phone?: string | null;
  customerName: string;
  products: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
  }>;
  comment?: string | null;
  createdTime: string;
}

export function OrderBillNotification({
  sessionIndex,
  phone,
  customerName,
  products,
  comment,
  createdTime,
}: OrderBillProps) {
  // Convert created_time to GMT+7
  const zonedDate = toZonedTime(new Date(createdTime), 'Asia/Bangkok');
  const formattedTime = format(zonedDate, 'dd/MM/yyyy HH:mm');

  return (
    <div className="space-y-2 font-mono text-sm text-center">
      <div className="text-base font-bold">
        #{sessionIndex} - {phone || 'Chưa có SĐT'}
      </div>
      <div className="font-semibold">{customerName}</div>
      <div className="space-y-1">
        {products.map((p, idx) => {
          // Remove the number before the first space in product name
          const cleanedName = p.product_name.replace(/^\d+\s+/, '');
          return (
            <div key={idx}>
              {p.product_code} - {cleanedName} (SL: {p.quantity})
            </div>
          );
        })}
      </div>
      {comment && <div className="text-muted-foreground italic">{comment}</div>}
      <div className="text-xs text-muted-foreground">{formattedTime}</div>
    </div>
  );
}
