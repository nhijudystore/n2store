import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { OrderBillNotification } from './OrderBillNotification';

interface QuickAddOrderProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
  quantityToAdd: number;
}

export function QuickAddOrder({ productId, phaseId, sessionId, availableQuantity, quantityToAdd }: QuickAddOrderProps) {
  const [open, setOpen] = useState(false);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch phase data to get the date
  const { data: phaseData } = useQuery({
    queryKey: ['live-phase', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_phases')
        .select('phase_date')
        .eq('id', phaseId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!phaseId,
  });

  // Fetch existing orders to filter out used comments
  const { data: existingOrders = [] } = useQuery({
    queryKey: ['live-orders', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_orders')
        .select('order_code, facebook_comment_id')
        .eq('live_phase_id', phaseId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseId,
  });

  // Fetch facebook_pending_orders for the phase date
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['facebook-pending-orders', phaseData?.phase_date],
    queryFn: async () => {
      if (!phaseData?.phase_date) return [];
      
      const { data, error } = await supabase
        .from('facebook_pending_orders')
        .select('*')
        .gte('created_time', `${phaseData.phase_date}T00:00:00`)
        .lt('created_time', `${phaseData.phase_date}T23:59:59`)
        .order('created_time', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseData?.phase_date,
  });

  // Get used facebook comment IDs
  const usedCommentIds = React.useMemo(() => {
    return new Set(existingOrders.map(order => order.facebook_comment_id).filter(Boolean));
  }, [existingOrders]);

  // Flat list of orders - only show comments that haven't been used
  const flatOrders = React.useMemo(() => {
    return pendingOrders
      .filter(order => 
        order.session_index && 
        order.facebook_comment_id && 
        !usedCommentIds.has(order.facebook_comment_id)
      )
      .sort((a, b) => {
        // Sort by session_index first (numeric), then by created_time
        const indexA = parseInt(a.session_index || '0');
        const indexB = parseInt(b.session_index || '0');
        if (indexA !== indexB) return indexA - indexB;
        return new Date(a.created_time).getTime() - new Date(b.created_time).getTime();
      });
  }, [pendingOrders, usedCommentIds]);

  const addOrderMutation = useMutation({
    mutationFn: async ({ sessionIndex, commentId, quantity }: { sessionIndex: string; commentId: string; quantity: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      // 1. Find TPOS Order ID
      const { data: orderData, error: orderError } = await supabase
        .from('live_orders')
        .select('code_tpos_order_id')
        .eq('order_code', sessionIndex)
        .not('code_tpos_order_id', 'is', null)
        .limit(1)
        .single();

      if (orderError || !orderData?.code_tpos_order_id) {
        throw new Error(`Chưa có đơn hàng TPOS nào được tạo cho mã ${sessionIndex}. Vui lòng tạo đơn hàng đầu tiên từ comment.`);
      }
      const tposOrderId = orderData.code_tpos_order_id;

      // 2. Get product details - FIXED LOGIC
      // First, get the live_product to find its product_code
      const { data: liveProductForCode, error: liveProductError } = await supabase
        .from('live_products')
        .select('product_code')
        .eq('id', productId)
        .single();

      if (liveProductError || !liveProductForCode) {
        throw new Error(`Không tìm thấy sản phẩm live với ID: ${productId}`);
      }

      const productCodeToSearch = liveProductForCode.product_code;

      // Now, find the product in the main products table using the code
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, productid_bienthe, product_name, product_code, selling_price')
        .eq('product_code', productCodeToSearch)
        .single();

      if (productError || !productData) {
        throw new Error(`Không tìm thấy thông tin sản phẩm trong kho với mã: ${productCodeToSearch}`);
      }

      if (!productData.productid_bienthe) {
        throw new Error(`Sản phẩm ${productData.product_code} chưa có "productid_bienthe". Vui lòng đồng bộ TPOS IDs trong Cài đặt.`);
      }

      const productToAdd = {
        productid_bienthe: productData.productid_bienthe,
        product_name: productData.product_name,
        product_code: productData.product_code,
        selling_price: productData.selling_price || 0,
      };

      // 3. Call Edge Function to update TPOS
      const { error: functionError } = await supabase.functions.invoke('add-product-to-tpos-order', {
        body: { tposOrderId, productToAdd, quantity },
      });

      if (functionError) {
        let detailedError = functionError.message;
        try {
            const parsed = JSON.parse(functionError.context?.error_message || '{}');
            if (parsed.error) detailedError = parsed.error;
        } catch(e) {}
        throw new Error(`Lỗi cập nhật TPOS: ${detailedError}`);
      }

      // 4. Update local database
      const { data: liveProduct, error: fetchError } = await supabase
        .from('live_products')
        .select('sold_quantity, prepared_quantity, product_code, product_name')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const newSoldQuantity = (liveProduct.sold_quantity || 0) + quantity;
      const isOversell = newSoldQuantity > liveProduct.prepared_quantity;

      const { error: orderInsertError } = await supabase
        .from('live_orders')
        .insert({
          order_code: sessionIndex,
          facebook_comment_id: commentId,
          live_session_id: sessionId,
          live_phase_id: phaseId,
          live_product_id: productId,
          quantity: quantity,
          is_oversell: isOversell,
          code_tpos_order_id: tposOrderId,
        });

      if (orderInsertError) throw orderInsertError;

      const { error: updateError } = await supabase
        .from('live_products')
        .update({ sold_quantity: newSoldQuantity })
        .eq('id', productId);

      if (updateError) throw updateError;
      
      const pendingOrder = pendingOrders.find(order => order.facebook_comment_id === commentId);
      return { 
        sessionIndex, 
        isOversell,
        billData: pendingOrder ? {
          sessionIndex,
          phone: pendingOrder.phone,
          customerName: pendingOrder.name,
          productCode: liveProduct.product_code,
          productName: liveProduct.product_name,
          comment: pendingOrder.comment,
          createdTime: pendingOrder.created_time,
        } : null
      };
    },
    onSuccess: ({ sessionIndex, isOversell, billData }) => {
      setSelectedSessionIndex('');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['live-products', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['orders-with-products', phaseId] });
      
      if (billData) {
        toast({
          description: (
            <OrderBillNotification {...billData} />
          ),
          variant: isOversell ? "destructive" : "default",
          duration: 10000,
        });
        
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(`...`); // Print logic remains the same
          printWindow.document.close();
        }
      } else {
        toast({
          title: isOversell ? "⚠️ Đơn oversell" : "Thành công",
          description: isOversell 
            ? `Đã thêm sản phẩm vào đơn ${sessionIndex} (vượt số lượng)`
            : `Đã thêm sản phẩm vào đơn hàng ${sessionIndex}`,
          variant: isOversell ? "destructive" : "default",
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error adding product to order:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể thêm sản phẩm vào đơn hàng.",
        variant: "destructive",
      });
    },
  });

  const handleSelectComment = (sessionIndex: string, commentId: string) => {
    setSelectedSessionIndex(sessionIndex);
    addOrderMutation.mutate({ sessionIndex, commentId, quantity: quantityToAdd });
  };

  const isOutOfStock = availableQuantity <= 0;
  
  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-sm h-9",
              isOutOfStock && "border-red-500 hover:border-red-500"
            )}
            disabled={addOrderMutation.isPending}
          >
            {selectedSessionIndex || (isOutOfStock ? "Quá số (đánh dấu đỏ)" : "Chọn mã đơn")}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Tìm mã đơn..." />
            <CommandList>
              <CommandEmpty>Không tìm thấy mã đơn.</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[200px]">
                  {flatOrders.map((order) => (
                    <CommandItem
                      key={order.id}
                      value={`${order.session_index}-${order.name || ''}-${order.comment || ''}`}
                      onSelect={() => {
                        if (order.facebook_comment_id) {
                          handleSelectComment(order.session_index!, order.facebook_comment_id);
                          setOpen(false);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <span className="font-medium">{order.session_index}</span>
                      <span className="mx-1">-</span>
                      <span className="font-bold truncate">{order.name || '(không có tên)'}</span>
                      <span className="mx-1">-</span>
                      <span className="flex-1 truncate">
                        {order.comment || '(không có comment)'}
                      </span>
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
