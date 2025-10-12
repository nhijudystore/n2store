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

      // Step 1: Lấy TPOS Order ID từ session
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

      // Step 2: Lấy TẤT CẢ orders trong session này
      const { data: allOrdersInSession, error: allOrdersError } = await supabase
        .from('live_orders')
        .select(`
          quantity,
          live_products (
            product_code
          )
        `)
        .eq('order_code', sessionIndex);

      if (allOrdersError) throw allOrdersError;

      // Step 3: Group by product_code và sum quantity
      const productSummary: Record<string, number> = {};
      allOrdersInSession?.forEach(order => {
        const code = (order.live_products as any)?.product_code;
        if (code) {
          productSummary[code] = (productSummary[code] || 0) + order.quantity;
        }
      });

      // Step 4: Lấy thông tin products từ database
      const productCodes = Object.keys(productSummary);
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('product_code, productid_bienthe, product_name, selling_price, id')
        .in('product_code', productCodes);

      if (productsError) throw productsError;
      if (!productsData || productsData.length === 0) {
        throw new Error('Không tìm thấy thông tin sản phẩm trong kho');
      }

      // Step 5: Build Details array
      const details = await Promise.all(
        productsData.map(async (prod) => {
          let productId = prod.productid_bienthe;

          // Nếu chưa có productid_bienthe, gọi TPOS để lấy
          if (!productId) {
            const { data: tposData, error: tposError } = await supabase.functions.invoke(
              'get-tpos-product-details',
              { 
                body: { 
                  product_code: prod.product_code,
                  fallback_name: prod.product_name,
                  fallback_price: prod.selling_price
                } 
              }
            );

            if (tposError) {
              console.error(`Error fetching TPOS details for ${prod.product_code}:`, tposError);
              throw new Error(`Không thể lấy thông tin TPOS cho sản phẩm ${prod.product_code}`);
            }

            if (tposData?.ProductId) {
              productId = tposData.ProductId;
              
              // Cập nhật lại database
              await supabase
                .from('products')
                .update({ productid_bienthe: productId })
                .eq('id', prod.id);
            } else {
              throw new Error(`Không tìm thấy sản phẩm ${prod.product_code} trên TPOS`);
            }
          }

          // Lấy thông tin real-time từ TPOS (luôn fetch để có data mới nhất)
          const { data: tposDetails, error: tposDetailsError } = await supabase.functions.invoke(
            'get-tpos-product-details',
            { 
              body: { 
                product_code: prod.product_code,
                fallback_name: prod.product_name,
                fallback_price: prod.selling_price
              } 
            }
          );

          if (tposDetailsError) {
            console.warn(`Warning: Could not fetch fresh TPOS details for ${prod.product_code}, using database values`);
          }

          return {
            ProductId: productId,
            ProductName: tposDetails?.ProductName || prod.product_name,
            ProductNameGet: tposDetails?.ProductNameGet || `[${prod.product_code}] ${prod.product_name}`,
            UOMId: 1,
            UOMName: "Cái",
            Quantity: productSummary[prod.product_code],
            Price: tposDetails?.Price || prod.selling_price || 0,
            Factor: 1,
            ProductWeight: 0,
            product_code: prod.product_code,
          };
        })
      );

      // Step 6: Gọi Edge Function để update TPOS
      const { error: functionError } = await supabase.functions.invoke(
        'add-product-to-tpos-order',
        { body: { tposOrderId, fullDetails: details } }
      );

      if (functionError) {
        let detailedError = functionError.message;
        try {
          const parsed = JSON.parse(functionError.context?.error_message || '{}');
          if (parsed.error) detailedError = parsed.error;
        } catch(e) {}
        throw new Error(`Lỗi cập nhật TPOS: ${detailedError}`);
      }

      // Step 7: Update database với order mới
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
          products: details.map(d => ({
            product_code: d.product_code,
            product_name: d.ProductName,
            quantity: d.Quantity
          })),
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
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <title>Bill - ${billData.sessionIndex}</title>
                <style>
                  body { font-family: 'Courier New', monospace; padding: 20px; text-align: center; }
                  .bill { max-width: 300px; margin: 0 auto; }
                  .header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                  .customer { font-size: 16px; font-weight: 600; margin: 10px 0; }
                  .product { font-size: 14px; margin: 5px 0; }
                  .comment { font-style: italic; color: #666; margin: 10px 0; }
                  .time { font-size: 12px; color: #999; margin-top: 10px; }
                </style>
              </head>
              <body>
                <div class="bill">
                  <div class="header">#${billData.sessionIndex} - ${billData.phone || 'Chưa có SĐT'}</div>
                  <div class="customer">${billData.customerName}</div>
                  <div class="products">
                    ${billData.products.map(p => 
                      `<div class="product">${p.product_code} - ${p.product_name} (SL: ${p.quantity})</div>`
                    ).join('')}
                  </div>
                  ${billData.comment ? `<div class="comment">${billData.comment}</div>` : ''}
                  <div class="time">${new Date(billData.createdTime).toLocaleString('vi-VN')}</div>
                </div>
                <script>
                  window.onload = () => {
                    window.print();
                    setTimeout(() => window.close(), 500);
                  };
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
