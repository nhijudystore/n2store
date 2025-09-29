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
