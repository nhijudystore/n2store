import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface QuickAddOrderProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
}

export function QuickAddOrder({ productId, phaseId, sessionId, availableQuantity }: QuickAddOrderProps) {
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
          live_phase_id: phaseId,
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
      
      return orderCodeValue;
    },
    onSuccess: (orderCodeValue) => {
      setOrderCode('');
      // Force refetch all related queries immediately
      queryClient.invalidateQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['live-products', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['orders-with-products', phaseId] });
      
      // Also refetch queries to ensure UI updates immediately
      queryClient.refetchQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.refetchQueries({ queryKey: ['live-products', phaseId] });
      queryClient.refetchQueries({ queryKey: ['orders-with-products', phaseId] });
      
      toast({
        title: "Thành công",
        description: `Đã thêm đơn hàng ${orderCodeValue}`,
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
    if (e.key === 'Enter' && orderCode.trim() && availableQuantity > 0) {
      addOrderMutation.mutate(orderCode.trim());
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Input
        placeholder={availableQuantity > 0 ? "Nhập mã đơn + Enter" : "Hết hàng"}
        value={orderCode}
        onChange={(e) => setOrderCode(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={addOrderMutation.isPending || availableQuantity <= 0}
        className="flex-1 text-sm"
      />
    </div>
  );
}