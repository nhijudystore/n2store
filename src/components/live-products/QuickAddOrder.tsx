import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { OrderBillNotification } from './OrderBillNotification';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface QuickAddOrderProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
}

export function QuickAddOrder({ productId, phaseId, sessionId, availableQuantity }: QuickAddOrderProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
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
    refetchInterval: 5000,
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!phaseData?.phase_date) return;

    const channel = supabase
      .channel('facebook-pending-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'facebook_pending_orders',
        },
        (payload) => {
          // Only refetch if the new order is for today's phase
          const createdTime = new Date(payload.new.created_time);
          const phaseDate = new Date(phaseData.phase_date);
          
          if (
            createdTime.getDate() === phaseDate.getDate() &&
            createdTime.getMonth() === phaseDate.getMonth() &&
            createdTime.getFullYear() === phaseDate.getFullYear()
          ) {
            queryClient.invalidateQueries({ queryKey: ['facebook-pending-orders', phaseData.phase_date] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phaseData?.phase_date, queryClient]);

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
        // Sort by session_index first (numeric), then by created_time (newest first)
        const indexA = parseInt(a.session_index || '0');
        const indexB = parseInt(b.session_index || '0');
        if (indexA !== indexB) return indexA - indexB;
        return new Date(b.created_time).getTime() - new Date(a.created_time).getTime();
      });
  }, [pendingOrders, usedCommentIds]);

  const addOrderMutation = useMutation({
    mutationFn: async ({ sessionIndex, commentId }: { sessionIndex: string; commentId: string }) => {
      // Get current product data to check if overselling
      const { data: product, error: fetchError } = await supabase
        .from('live_products')
        .select('sold_quantity, prepared_quantity, product_code, product_name')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Get pending order details for bill
      const pendingOrder = pendingOrders.find(order => order.facebook_comment_id === commentId);

      // Check if this order will be an oversell
      const newSoldQuantity = (product.sold_quantity || 0) + 1;
      const isOversell = newSoldQuantity > product.prepared_quantity;

      // Insert new order with oversell flag and comment ID
      const { error: orderError } = await supabase
        .from('live_orders')
        .insert({
          order_code: sessionIndex,
          facebook_comment_id: commentId,
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
      
      return { 
        sessionIndex, 
        isOversell,
        billData: pendingOrder ? {
          sessionIndex,
          phone: pendingOrder.phone,
          customerName: pendingOrder.name,
          productCode: product.product_code,
          productName: product.product_name,
          comment: pendingOrder.comment,
          createdTime: pendingOrder.created_time,
        } : null
      };
    },
    onSuccess: ({ sessionIndex, isOversell, billData }) => {
      setInputValue('');
      // Force refetch all related queries immediately
      queryClient.invalidateQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['live-products', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['orders-with-products', phaseId] });
      
      // Also refetch queries to ensure UI updates immediately
      queryClient.refetchQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.refetchQueries({ queryKey: ['live-products', phaseId] });
      queryClient.refetchQueries({ queryKey: ['orders-with-products', phaseId] });
      
      if (billData) {
        // Create a temporary element for printing
        const printContent = document.createElement('div');
        printContent.innerHTML = `
          <div style="font-family: monospace; text-align: center; padding: 20px;">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">
              #${billData.sessionIndex} - ${billData.phone || 'Chưa có SĐT'}
            </div>
            <div style="font-weight: 600; margin-bottom: 8px;">${billData.customerName}</div>
            <div style="margin-bottom: 8px;">${billData.productCode} - ${billData.productName.replace(/^\d+\s+/, '')}</div>
            ${billData.comment ? `<div style="font-style: italic; margin-bottom: 8px; color: #666;">${billData.comment}</div>` : ''}
            <div style="margin: 10px 0;">
              <svg id="barcode-${billData.sessionIndex}"></svg>
            </div>
          </div>
        `;
        
        // Show toast notification
        toast({
          description: (
            <OrderBillNotification {...billData} />
          ),
          variant: isOversell ? "destructive" : "default",
          duration: 10000,
        });
        
        // Trigger print using hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Bill #${billData.sessionIndex}</title>
                <style>
                  @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { margin: 0; padding: 10px; }
                  }
                  @media screen {
                    body { visibility: hidden; }
                  }
                  body { 
                    font-family: monospace; 
                    text-align: center;
                    font-size: 12px;
                  }
                </style>
              </head>
              <body>
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">
                  #${billData.sessionIndex} - ${billData.phone || 'Chưa có SĐT'}
                </div>
                <div style="font-weight: 600; margin-bottom: 8px;">${billData.customerName}</div>
                <div style="margin-bottom: 8px;">${billData.productCode} - ${billData.productName.replace(/^\d+\s+/, '')}</div>
                ${billData.comment ? `<div style="font-style: italic; margin-bottom: 8px; color: #666;">${billData.comment}</div>` : ''}
                <div style="font-size: 12px; color: #666; margin-top: 10px;">
                  ${new Date(billData.createdTime).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok', hour12: false })}
                </div>
              </body>
            </html>
          `);
          doc.close();
          
          // Wait for content to load then print
          setTimeout(() => {
            iframe.contentWindow?.print();
            
            // Remove iframe after printing
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 1000);
          }, 100);
        }
      } else {
        toast({
          title: isOversell ? "⚠️ Đơn oversell" : "Thành công",
          description: isOversell 
            ? `Đã thêm đơn ${sessionIndex} (vượt số lượng - đánh dấu đỏ)`
            : `Đã thêm đơn hàng ${sessionIndex}`,
          variant: isOversell ? "destructive" : "default",
        });
      }
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

  const handleAddOrder = () => {
    const trimmedValue = inputValue.trim();
    
    if (!trimmedValue) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã đơn hàng",
        variant: "destructive",
      });
      return;
    }

    // Find the order by session_index
    const order = flatOrders.find(o => o.session_index === trimmedValue);
    
    if (!order) {
      toast({
        title: "Không tìm thấy",
        description: `Không tìm thấy đơn hàng với mã "${trimmedValue}" hoặc đã được sử dụng`,
        variant: "destructive",
      });
      return;
    }

    if (!order.facebook_comment_id) {
      toast({
        title: "Lỗi",
        description: "Đơn hàng không có comment ID",
        variant: "destructive",
      });
      return;
    }

    addOrderMutation.mutate({ 
      sessionIndex: order.session_index!, 
      commentId: order.facebook_comment_id 
    });
  };

  const handleSelectOrder = (order: typeof flatOrders[0]) => {
    if (!order.facebook_comment_id) {
      toast({
        title: "Lỗi",
        description: "Đơn hàng không có comment ID",
        variant: "destructive",
      });
      return;
    }

    setInputValue(order.session_index!);
    setIsOpen(false);
    
    addOrderMutation.mutate({ 
      sessionIndex: order.session_index!, 
      commentId: order.facebook_comment_id 
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddOrder();
    }
  };

  const isOutOfStock = availableQuantity <= 0;
  
  return (
    <div className="w-full flex gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex-1 relative">
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setIsOpen(true)}
              placeholder={isOutOfStock ? "Quá số (đánh dấu đỏ)" : "Nhập mã đơn..."}
              className={cn(
                "text-sm h-9",
                isOutOfStock && "border-red-500"
              )}
              disabled={addOrderMutation.isPending}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[400px] p-0" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Tìm mã đơn..." 
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>Không tìm thấy mã đơn.</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[200px]">
                  {flatOrders
                    .filter(order => 
                      !inputValue || 
                      order.session_index?.includes(inputValue) ||
                      order.name?.toLowerCase().includes(inputValue.toLowerCase()) ||
                      order.comment?.toLowerCase().includes(inputValue.toLowerCase())
                    )
                    .map((order) => (
                      <CommandItem
                        key={order.id}
                        value={order.session_index!}
                        onSelect={() => handleSelectOrder(order)}
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
      
      <Button
        onClick={handleAddOrder}
        disabled={addOrderMutation.isPending || !inputValue.trim()}
        size="sm"
        className="h-9"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}