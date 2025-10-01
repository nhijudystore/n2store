import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    product_code: string;
    product_name: string;
    variant?: string;
    prepared_quantity: number;
    live_phase_id?: string;
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
  const [duplicateWarning, setDuplicateWarning] = useState<string>("");
  const queryClient = useQueryClient();
  const productCodeInputRef = useRef<HTMLInputElement>(null);

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
      setDuplicateWarning("");
      // Auto-focus on product code field
      setTimeout(() => productCodeInputRef.current?.focus(), 100);
    }
  }, [product?.id, open, form]);

  // Check for duplicates when product_code or variant changes
  const checkDuplicate = async (productCode: string, variant: string) => {
    if (!product?.live_phase_id || !productCode.trim()) return false;

    const { data, error } = await supabase
      .from("live_products")
      .select("id, product_code, variant")
      .eq("live_phase_id", product.live_phase_id)
      .eq("product_code", productCode)
      .neq("id", product.id);

    if (error) {
      console.error("Error checking duplicates:", error);
      return false;
    }

    const normalizedVariant = variant.trim().toLowerCase() || null;
    const isDuplicate = data.some(p => {
      const existingVariant = p.variant?.trim().toLowerCase() || null;
      return existingVariant === normalizedVariant;
    });

    if (isDuplicate) {
      setDuplicateWarning(
        variant.trim() 
          ? `Sản phẩm "${productCode}" với biến thể "${variant}" đã tồn tại trong phiên live này`
          : `Sản phẩm "${productCode}" (không có biến thể) đã tồn tại trong phiên live này`
      );
      return true;
    }

    setDuplicateWarning("");
    return false;
  };

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

  const onSubmit = async (data: FormData) => {
    if (!product?.id) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy sản phẩm để cập nhật",
        variant: "destructive",
      });
      return;
    }

    if (!data.product_code.trim()) {
      toast({
        title: "Lỗi",
        description: "Mã sản phẩm không được để trống",
        variant: "destructive",
      });
      return;
    }

    if (!data.product_name.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên sản phẩm không được để trống",
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

    // Check for duplicates before submitting
    const isDuplicate = await checkDuplicate(data.product_code, data.variant);
    if (isDuplicate) {
      toast({
        title: "Không thể cập nhật",
        description: duplicateWarning,
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
          <form 
            onSubmit={form.handleSubmit(onSubmit)} 
            className="space-y-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form.handleSubmit(onSubmit)();
              }
            }}
          >
            {duplicateWarning && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{duplicateWarning}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="product_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã sản phẩm</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập mã sản phẩm" 
                      {...field}
                      ref={productCodeInputRef}
                      onBlur={() => {
                        const variant = form.getValues("variant");
                        checkDuplicate(field.value, variant);
                      }}
                    />
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
                    <Input 
                      placeholder="Nhập biến thể (không bắt buộc)" 
                      {...field}
                      onBlur={() => {
                        const productCode = form.getValues("product_code");
                        checkDuplicate(productCode, field.value);
                      }}
                    />
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
              <Button type="submit" disabled={isSubmitting || !product?.id || !!duplicateWarning}>
                {isSubmitting ? "Đang cập nhật..." : "Cập nhật sản phẩm"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}