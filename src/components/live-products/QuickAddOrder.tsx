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
        .select('order_code')
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

  // Get used order codes
  const usedOrderCodes = React.useMemo(() => {
    return new Set(existingOrders.map(order => order.order_code));
  }, [existingOrders]);

  // Group orders by session_index and filter out individual used comments
  const groupedOrders = React.useMemo(() => {
    const groups = new Map<string, typeof pendingOrders>();
    pendingOrders.forEach(order => {
      if (order.session_index) {
        // Only add this order if its session_index hasn't been used yet
        if (!usedOrderCodes.has(order.session_index)) {
          const existing = groups.get(order.session_index) || [];
          groups.set(order.session_index, [...existing, order]);
        }
      }
    });
    // Only keep sessionIndexes that still have comments
    const filteredGroups = new Map<string, typeof pendingOrders>();
    groups.forEach((orders, sessionIndex) => {
      if (orders.length > 0) {
        filteredGroups.set(sessionIndex, orders);
      }
    });
    return filteredGroups;
  }, [pendingOrders, usedOrderCodes]);

  const uniqueSessionIndexes = Array.from(groupedOrders.keys());

  const addOrderMutation = useMutation({
    mutationFn: async (sessionIndex: string) => {
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
          order_code: sessionIndex,
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
      
      return { sessionIndex, isOversell };
    },
    onSuccess: ({ sessionIndex, isOversell }) => {
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
      
      toast({
        title: isOversell ? "⚠️ Đơn oversell" : "Thành công",
        description: isOversell 
          ? `Đã thêm đơn ${sessionIndex} (vượt số lượng - đánh dấu đỏ)`
          : `Đã thêm đơn hàng ${sessionIndex}`,
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

  const handleSelectComment = (sessionIndex: string) => {
    setSelectedSessionIndex(sessionIndex);
    addOrderMutation.mutate(sessionIndex);
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
                              {orders.map((order) => (
                                <div 
                                  key={order.id} 
                                  className="mb-2 cursor-pointer rounded-md border bg-card p-3 text-sm transition-colors hover:bg-accent hover:shadow-sm"
                                  onClick={() => {
                                    handleSelectComment(sessionIndex);
                                    setOpen(false);
                                  }}
                                >
                                  {order.comment ? (
                                    <p className="text-foreground leading-relaxed">{order.comment}</p>
                                  ) : (
                                    <p className="text-muted-foreground italic">Không có comment</p>
                                  )}
                                </div>
                              ))}
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