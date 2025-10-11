import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { OrderBillNotification } from './OrderBillNotification';

interface QuickAddOrderProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
}

export function QuickAddOrder({ productId, phaseId, sessionId, availableQuantity }: QuickAddOrderProps) {
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

  // Group orders by session_index - only show comments that haven't been used
  const groupedOrders = React.useMemo(() => {
    const groups = new Map<string, typeof pendingOrders>();
    pendingOrders.forEach(order => {
      if (order.session_index && order.facebook_comment_id && !usedCommentIds.has(order.facebook_comment_id)) {
        const existing = groups.get(order.session_index) || [];
        groups.set(order.session_index, [...existing, order]);
      }
    });
    return groups;
  }, [pendingOrders, usedCommentIds]);

  const uniqueSessionIndexes = Array.from(groupedOrders.keys());

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
      setSelectedSessionIndex('');
      setOpen(false);
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
        
        // Trigger print
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Bill #${billData.sessionIndex}</title>
                <style>
                  body { 
                    font-family: monospace; 
                    margin: 0; 
                    padding: 20px;
                    text-align: center;
                  }
                  @media print {
                    body { margin: 0; padding: 10px; }
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
                <div style="font-size: 12px; color: #666; margin-top: 10px;">${new Date(billData.createdTime).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok', hour12: false })}</div>
                <script>
                  setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 100);
                  }, 500);
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
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

  const handleSelectComment = (sessionIndex: string, commentId: string) => {
    setSelectedSessionIndex(sessionIndex);
    addOrderMutation.mutate({ sessionIndex, commentId });
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
                  {uniqueSessionIndexes.map((sessionIndex) => {
                    const orders = groupedOrders.get(sessionIndex) || [];
                    return (
                      <HoverCard key={sessionIndex} openDelay={200}>
                        <HoverCardTrigger asChild>
                          <CommandItem
                            value={sessionIndex}
                            className="cursor-default hover:bg-accent/50 font-medium"
                          >
                            <span className="text-base">{sessionIndex}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              ({orders.length} comment{orders.length > 1 ? 's' : ''})
                            </span>
                          </CommandItem>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-96 p-0" side="right" sideOffset={10}>
                          <div className="border-b bg-muted/50 px-4 py-3">
                            <h4 className="text-sm font-semibold">
                              Chọn comment để thêm đơn ({orders.length})
                            </h4>
                          </div>
                          <ScrollArea className="max-h-[300px]">
                            <div className="p-2">
                              {orders.length > 0 ? (
                                orders.map((order) => (
                                  <div 
                                    key={order.id} 
                                    className="mb-2 cursor-pointer rounded-md border bg-card p-3 text-sm transition-colors hover:bg-accent hover:shadow-sm"
                                    onClick={() => {
                                      if (order.facebook_comment_id) {
                                        handleSelectComment(sessionIndex, order.facebook_comment_id);
                                        setOpen(false);
                                      }
                                    }}
                                  >
                                    {order.comment ? (
                                      <p className="text-foreground leading-relaxed">{order.comment}</p>
                                    ) : (
                                      <p className="text-muted-foreground italic">Không có comment</p>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 text-center text-sm text-muted-foreground">
                                  Tất cả comments đã được sử dụng
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}