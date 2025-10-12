import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface QuickAddOrderInlineProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
}

export function QuickAddOrderInline({ productId, phaseId, sessionId, availableQuantity }: QuickAddOrderInlineProps) {
  const [sessionIndex, setSessionIndex] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addOrderMutation = useMutation({
    mutationFn: async () => {
      if (!sessionIndex.trim()) {
        throw new Error('Vui lòng nhập mã đơn hàng');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      // Call edge function for fast, non-blocking order creation
      const response = await fetch(
        `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/create-live-order`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            productId,
            phaseId,
            sessionId,
            orderCode: sessionIndex.trim()
          }),
        }
      );

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create order');
      }

      return responseData;
    },
    onSuccess: (data) => {
      const currentSessionIndex = sessionIndex;
      setSessionIndex('');
      
      // Only invalidate queries (non-blocking) - they will refetch automatically
      queryClient.invalidateQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['live-products', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['orders-with-products', phaseId] });
      
      toast({
        title: data.isOversell ? "⚠️ Đơn oversell" : "Thành công",
        description: data.isOversell 
          ? `Đã thêm đơn ${currentSessionIndex} (vượt số lượng - đánh dấu đỏ)`
          : `Đã thêm đơn hàng ${currentSessionIndex}`,
        variant: data.isOversell ? "destructive" : "default",
      });
    },
    onError: (error: any) => {
      console.error('Error adding order:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể thêm đơn hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const handleAddOrder = () => {
    if (!sessionIndex.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã đơn hàng",
        variant: "destructive",
      });
      return;
    }
    
    addOrderMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddOrder();
    }
  };

  const isOutOfStock = availableQuantity <= 0;
  
  return (
    <div className="w-full flex gap-2">
      <Input
        type="text"
        value={sessionIndex}
        onChange={(e) => setSessionIndex(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={isOutOfStock ? "Quá số (đánh dấu đỏ)" : "Nhập mã đơn..."}
        className={cn(
          "text-sm h-9",
          isOutOfStock && "border-red-500"
        )}
        disabled={addOrderMutation.isPending}
      />
      
      <Button
        onClick={handleAddOrder}
        disabled={addOrderMutation.isPending || !sessionIndex.trim()}
        size="sm"
        className="h-9 shrink-0"
      >
        {addOrderMutation.isPending ? "..." : "Thêm"}
      </Button>
    </div>
  );
}
