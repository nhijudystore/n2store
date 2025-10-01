import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    product_code: string;
    product_name: string;
    variant?: string;
    prepared_quantity: number;
  } | null;
}

interface FormData {
  product_code: string;
  product_name: string;
  variant: string;
  prepared_quantity: number;
}

export function EditProductDialog({ open, onOpenChange, product }: EditProductDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      product_code: "",
      product_name: "",
      variant: "",
      prepared_quantity: 0,
    },
  });

  // Reset form when product changes or dialog opens
  useEffect(() => {
    if (product && open) {
      form.reset({
        product_code: product.product_code,
        product_name: product.product_name,
        variant: product.variant || "",
        prepared_quantity: product.prepared_quantity,
      });
    }
  }, [product?.id, open, form]);

  const updateProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!product?.id) throw new Error("No product selected");
      
      const { error } = await supabase
        .from("live_products")
        .update({
          product_code: data.product_code,
          product_name: data.product_name,
          variant: data.variant.trim() || null,
          prepared_quantity: data.prepared_quantity,
        })
        .eq("id", product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật sản phẩm thành công",
      });
      onOpenChange(false);
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Error updating product:", error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật sản phẩm. Vui lòng thử lại.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: FormData) => {
    if (!product?.id) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy sản phẩm để cập nhật",
        variant: "destructive",
      });
      return;
    }

    if (!data.product_code.trim() || !data.product_name.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin sản phẩm",
        variant: "destructive",
      });
      return;
    }

    if (data.prepared_quantity < 0) {
      toast({
        title: "Lỗi",
        description: "Số lượng chuẩn bị phải lớn hơn hoặc bằng 0",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    updateProductMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa sản phẩm</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã sản phẩm</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập mã sản phẩm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên sản phẩm</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập tên sản phẩm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="variant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biến thể</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập biến thể (không bắt buộc)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prepared_quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số lượng chuẩn bị</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting || !product?.id}>
                {isSubmitting ? "Đang cập nhật..." : "Cập nhật sản phẩm"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}