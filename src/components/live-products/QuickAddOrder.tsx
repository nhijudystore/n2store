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
      // Get current product data to check if overselling
      const { data: product, error: fetchError } = await supabase
        .from('live_products')
        .select('sold_quantity, prepared_quantity')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Check if this order will be an oversell
      const newSoldQuantity = (product.sold_quantity || 0) + 1;
      const isOversell = newSoldQuantity > product.prepared_quantity;

      // Insert new order with oversell flag
      const { error: orderError } = await supabase
        .from('live_orders')
        .insert({
          order_code: orderCodeValue,
          live_session_id: sessionId,
          live_phase_id: phaseId,
          live_product_id: productId,
          quantity: 1,
          is_oversell: isOversell
        });

      if (orderError) throw orderError;

      // Update sold quantity
      const { error: updateError } = await supabase
        .from('live_products')
        .update({ sold_quantity: newSoldQuantity })
        .eq('id', productId);

      if (updateError) throw updateError;
      
      return { orderCodeValue, isOversell };
    },
    onSuccess: ({ orderCodeValue, isOversell }) => {
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
        title: isOversell ? "⚠️ Đơn oversell" : "Thành công",
        description: isOversell 
          ? `Đã thêm đơn ${orderCodeValue} (vượt số lượng - đánh dấu đỏ)`
          : `Đã thêm đơn hàng ${orderCodeValue}`,
        variant: isOversell ? "destructive" : "default",
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

  const isOutOfStock = availableQuantity <= 0;
  
  return (
    <div className="flex items-center gap-2 w-full">
      <Plus className={`h-4 w-4 flex-shrink-0 ${isOutOfStock ? 'text-red-500' : 'text-muted-foreground'}`} />
      <Input
        placeholder={isOutOfStock ? "Quá số (đánh dấu đỏ)" : "Nhập mã đơn + Enter"}
        value={orderCode}
        onChange={(e) => setOrderCode(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={addOrderMutation.isPending}
        className={`flex-1 text-sm ${isOutOfStock ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
      />
    </div>
  );
}