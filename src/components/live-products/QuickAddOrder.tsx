import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface QuickAddOrderProps {
  sessionId: string;
  productId: string;
}

export function QuickAddOrder({ sessionId, productId }: QuickAddOrderProps) {
  const [orderCode, setOrderCode] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addOrderMutation = useMutation({
    mutationFn: async (orderCodeValue: string) => {
      // Insert new order
      const { error: orderError } = await supabase
        .from('live_orders')
        .insert({
          order_code: orderCodeValue,
          live_session_id: sessionId,
          live_product_id: productId,
          quantity: 1
        });

      if (orderError) throw orderError;

      // Update sold quantity
      const { data: product, error: fetchError } = await supabase
        .from('live_products')
        .select('sold_quantity')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from('live_products')
        .update({ sold_quantity: (product.sold_quantity || 0) + 1 })
        .eq('id', productId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setOrderCode('');
      queryClient.invalidateQueries({ queryKey: ['liveOrders'] });
      queryClient.invalidateQueries({ queryKey: ['liveProducts'] });
      toast({
        title: "Thành công",
        description: "Đã thêm đơn hàng mới",
      });
    },
    onError: (error) => {
      console.error('Error adding order:', error);
      toast({
        title: "Lỗi",
        description: "Không thể thêm đơn hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && orderCode.trim()) {
      addOrderMutation.mutate(orderCode.trim());
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Plus className="h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Nhập mã đơn hàng và bấm Enter"
        value={orderCode}
        onChange={(e) => setOrderCode(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={addOrderMutation.isPending}
        className="flex-1"
      />
    </div>
  );
}