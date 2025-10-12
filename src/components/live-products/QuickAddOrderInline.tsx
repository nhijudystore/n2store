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

      // Get current product data
      const { data: product, error: fetchError } = await supabase
        .from('live_products')
        .select('sold_quantity, prepared_quantity, product_code, product_name')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Check if overselling
      const newSoldQuantity = (product.sold_quantity || 0) + 1;
      const isOversell = newSoldQuantity > product.prepared_quantity;

      // Insert new order
      const { error: orderError } = await supabase
        .from('live_orders')
        .insert({
          order_code: sessionIndex.trim(),
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
      
      return { isOversell };
    },
    onSuccess: ({ isOversell }) => {
      setSessionIndex('');
      
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['live-products', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['orders-with-products', phaseId] });
      
      queryClient.refetchQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.refetchQueries({ queryKey: ['live-products', phaseId] });
      queryClient.refetchQueries({ queryKey: ['orders-with-products', phaseId] });
      
      toast({
        title: isOversell ? "⚠️ Đơn oversell" : "Thành công",
        description: isOversell 
          ? `Đã thêm đơn ${sessionIndex} (vượt số lượng - đánh dấu đỏ)`
          : `Đã thêm đơn hàng ${sessionIndex}`,
        variant: isOversell ? "destructive" : "default",
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
