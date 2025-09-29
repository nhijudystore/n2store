import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const formSchema = z.object({
  quantity: z.coerce.number().min(1, "Số lượng phải lớn hơn 0"),
});

interface EditOrderItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItem: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    orders?: Array<{
      id: string;
      live_product_id: string;
      product_name: string;
      product_code: string;
      quantity: number;
      order_code: string;
      created_at?: string;
      order_date?: string;
      live_session_id: string;
      live_phase_id?: string;
      sold_quantity?: number;
    }>;
  } | null;
  phaseId: string;
}

export function EditOrderItemDialog({
  open,
  onOpenChange,
  orderItem,
  phaseId,
}: EditOrderItemDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  useEffect(() => {
    if (orderItem) {
      form.reset({
        quantity: orderItem.quantity,
      });
    }
  }, [orderItem, form]);

  const updateOrderItemMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!orderItem) return;

      // If we have multiple orders (aggregated), use smart logic
      if (orderItem.orders && orderItem.orders.length > 0) {
        const orders = orderItem.orders;
        const currentTotalQty = orders.reduce((sum, o) => sum + o.quantity, 0);
        const newTotalQty = values.quantity;
        const diff = newTotalQty - currentTotalQty;

        if (diff === 0) return;

        if (diff < 0) {
          // DECREASE: Delete newest records first
          const deleteCount = Math.abs(diff);
          
          // Sort by created_at DESC to get newest records
          const sortedOrders = [...orders].sort((a, b) => {
            const dateA = new Date(a.created_at || a.order_date || 0).getTime();
            const dateB = new Date(b.created_at || b.order_date || 0).getTime();
            return dateB - dateA;
          });
          
          let remaining = deleteCount;
          const ordersToDelete: string[] = [];
          
          for (const order of sortedOrders) {
            if (remaining <= 0) break;
            
            if (order.quantity <= remaining) {
              // Delete entire order
              ordersToDelete.push(order.id);
              remaining -= order.quantity;
            } else {
              // Decrease quantity of this order
              const { error } = await supabase
                .from("live_orders")
                .update({ quantity: order.quantity - remaining })
                .eq("id", order.id);
              
              if (error) throw error;
              remaining = 0;
            }
          }
          
          // Delete marked orders
          if (ordersToDelete.length > 0) {
            const { error } = await supabase
              .from("live_orders")
              .delete()
              .in("id", ordersToDelete);
            
            if (error) throw error;
          }
          
          // Fetch current sold_quantity
          const { data: product, error: productFetchError } = await supabase
            .from("live_products")
            .select("sold_quantity")
            .eq("id", orderItem.product_id)
            .single();
          
          if (productFetchError) throw productFetchError;
          
          // Update sold_quantity
          const { error: productError } = await supabase
            .from("live_products")
            .update({ 
              sold_quantity: Math.max(0, product.sold_quantity - deleteCount)
            })
            .eq("id", orderItem.product_id);
          
          if (productError) throw productError;
          
        } else {
          // INCREASE: Create new records with quantity = 1
          const addCount = diff;
          const firstOrder = orders[0];
          
          const newRecords = Array.from({ length: addCount }, () => ({
            live_session_id: firstOrder.live_session_id,
            live_phase_id: firstOrder.live_phase_id || null,
            live_product_id: firstOrder.live_product_id,
            order_code: firstOrder.order_code,
            quantity: 1,
          }));
          
          const { error } = await supabase
            .from("live_orders")
            .insert(newRecords);
          
          if (error) throw error;
          
          // Fetch current sold_quantity
          const { data: product, error: productFetchError } = await supabase
            .from("live_products")
            .select("sold_quantity")
            .eq("id", orderItem.product_id)
            .single();
          
          if (productFetchError) throw productFetchError;
          
          // Update sold_quantity
          const { error: productError } = await supabase
            .from("live_products")
            .update({ 
              sold_quantity: product.sold_quantity + addCount
            })
            .eq("id", orderItem.product_id);
          
          if (productError) throw productError;
        }
      } else {
        // Single order item - original logic
        const quantityDiff = values.quantity - orderItem.quantity;

        // Update order quantity
        const { error: orderError } = await supabase
          .from("live_orders")
          .update({ quantity: values.quantity })
          .eq("id", orderItem.id);

        if (orderError) throw orderError;

        // Update product sold_quantity
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", orderItem.product_id)
          .single();

        if (productFetchError) throw productFetchError;

        const { error: productUpdateError } = await supabase
          .from("live_products")
          .update({ 
            sold_quantity: Math.max(0, product.sold_quantity + quantityDiff) 
          })
          .eq("id", orderItem.product_id);

        if (productUpdateError) throw productUpdateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", phaseId] });
      toast.success("Đã cập nhật số lượng sản phẩm");
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error updating order item:", error);
      toast.error("Có lỗi xảy ra khi cập nhật số lượng");
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateOrderItemMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa số lượng sản phẩm</DialogTitle>
          <DialogDescription>
            Cập nhật số lượng cho sản phẩm: <strong>{orderItem?.product_name}</strong>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số lượng</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Nhập số lượng"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={updateOrderItemMutation.isPending}
              >
                {updateOrderItemMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
