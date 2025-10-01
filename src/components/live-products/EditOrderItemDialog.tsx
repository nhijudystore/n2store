import { useEffect, useState } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  quantity: z.coerce.number().min(0, "Số lượng không được âm"),
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingQuantity, setPendingQuantity] = useState<number | null>(null);

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

      // If we have multiple orders (aggregated), consolidate into single order
      if (orderItem.orders && orderItem.orders.length > 0) {
        const orders = orderItem.orders;
        const currentTotalQty = orders.reduce((sum, o) => sum + o.quantity, 0);
        const newTotalQty = values.quantity;
        const diff = newTotalQty - currentTotalQty;

        if (diff === 0) return;

        // Keep the first order and delete the rest
        const firstOrder = orders[0];
        const ordersToDelete = orders.slice(1).map(o => o.id);

        // Update the first order with new total quantity
        const { error: updateError } = await supabase
          .from("live_orders")
          .update({ quantity: newTotalQty })
          .eq("id", firstOrder.id);

        if (updateError) throw updateError;

        // Delete other orders with same order_code
        if (ordersToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from("live_orders")
            .delete()
            .in("id", ordersToDelete);

          if (deleteError) throw deleteError;
        }

        // Update product sold_quantity
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", orderItem.product_id)
          .single();

        if (productFetchError) throw productFetchError;

        const { error: productError } = await supabase
          .from("live_products")
          .update({ 
            sold_quantity: Math.max(0, product.sold_quantity + diff)
          })
          .eq("id", orderItem.product_id);

        if (productError) throw productError;

      } else {
        // Single order item - update quantity directly
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

  const deleteOrderByCodeMutation = useMutation({
    mutationFn: async () => {
      if (!orderItem) return;

      // Get order_code from the first order
      const orderCode = orderItem.orders && orderItem.orders.length > 0 
        ? orderItem.orders[0].order_code 
        : null;

      if (!orderCode) {
        throw new Error("Không tìm thấy mã đơn hàng");
      }

      // Get all orders with this order_code
      const { data: ordersToDelete, error: fetchError } = await supabase
        .from("live_orders")
        .select("id, live_product_id, quantity")
        .eq("order_code", orderCode);

      if (fetchError) throw fetchError;

      if (!ordersToDelete || ordersToDelete.length === 0) return;

      // Update sold_quantity for each affected product
      for (const order of ordersToDelete) {
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", order.live_product_id)
          .single();

        if (productFetchError) throw productFetchError;

        const { error: productUpdateError } = await supabase
          .from("live_products")
          .update({ 
            sold_quantity: Math.max(0, product.sold_quantity - order.quantity)
          })
          .eq("id", order.live_product_id);

        if (productUpdateError) throw productUpdateError;
      }

      // Delete all orders with this order_code
      const { error: deleteError } = await supabase
        .from("live_orders")
        .delete()
        .eq("order_code", orderCode);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", phaseId] });
      toast.success("Đã xóa đơn hàng thành công");
      onOpenChange(false);
      setShowDeleteConfirm(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error deleting order:", error);
      toast.error("Có lỗi xảy ra khi xóa đơn hàng");
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (values.quantity === 0) {
      setPendingQuantity(values.quantity);
      setShowDeleteConfirm(true);
    } else {
      updateOrderItemMutation.mutate(values);
    }
  };

  const handleDeleteConfirm = () => {
    deleteOrderByCodeMutation.mutate();
  };

  const orderCode = orderItem?.orders && orderItem.orders.length > 0 
    ? orderItem.orders[0].order_code 
    : "";

  return (
    <>
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
                        min="0"
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa đơn hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có muốn xóa đơn hàng <strong>{orderCode}</strong> không? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteOrderByCodeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrderByCodeMutation.isPending ? "Đang xóa..." : "Xóa đơn hàng"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
