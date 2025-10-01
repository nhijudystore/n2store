import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AddProductToLiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
  sessionId: string;
}

interface FormData {
  product_code: string;
  product_name: string;
  variants: { name: string; quantity: number }[];
}

export function AddProductToLiveDialog({ open, onOpenChange, phaseId, sessionId }: AddProductToLiveDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      product_code: "",
      product_name: "",
      variants: [{ name: "", quantity: 0 }],
    },
  });

  const addProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const productCode = data.product_code.trim() || "N/A";
      const productName = data.product_name.trim() || "Không có";
      
      // Check for duplicates for each variant
      for (const variant of data.variants) {
        const variantName = variant.name.trim() || null;
        
        const { data: existingProducts, error: checkError } = await supabase
          .from("live_products")
          .select("id")
          .eq("live_phase_id", phaseId)
          .eq("product_code", productCode)
          .eq("variant", variantName);

        if (checkError) throw checkError;

        if (existingProducts && existingProducts.length > 0) {
          throw new Error(`Biến thể "${variant.name || '(Không có)'}" đã tồn tại cho sản phẩm này`);
        }
      }

      // Insert all variants
      const insertData = data.variants.map(variant => ({
        live_session_id: sessionId,
        live_phase_id: phaseId,
        product_code: productCode,
        product_name: productName,
        variant: variant.name.trim() || null,
        prepared_quantity: variant.quantity,
        sold_quantity: 0,
      }));

      const { error } = await supabase
        .from("live_products")
        .insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      toast.success("Đã thêm sản phẩm vào phiên live thành công");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error adding product to live:", error);
      toast.error(error.message || "Có lỗi xảy ra khi thêm sản phẩm");
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!phaseId) {
      toast.error("Vui lòng chọn một phiên live");
      return;
    }

    // Validate variants
    if (data.variants.length === 0) {
      toast.error("Vui lòng thêm ít nhất một biến thể");
      return;
    }

    for (const variant of data.variants) {
      if (variant.quantity < 0) {
        toast.error("Số lượng phải lớn hơn hoặc bằng 0");
        return;
      }
    }

    // Check for duplicate variant names
    const variantNames = data.variants.map(v => v.name.trim().toLowerCase()).filter(n => n);
    const duplicates = variantNames.filter((name, index) => variantNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      toast.error("Có biến thể bị trùng lặp");
      return;
    }

    setIsSubmitting(true);
    try {
      await addProductMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addVariant = () => {
    const currentVariants = form.getValues("variants");
    form.setValue("variants", [...currentVariants, { name: "", quantity: 0 }]);
  };

  const removeVariant = (index: number) => {
    const currentVariants = form.getValues("variants");
    if (currentVariants.length > 1) {
      form.setValue("variants", currentVariants.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm Sản Phẩm Vào Live</DialogTitle>
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
                    <Input 
                      placeholder="Nhập mã sản phẩm (không bắt buộc)"
                      {...field}
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
                    <Input 
                      placeholder="Nhập tên sản phẩm (không bắt buộc)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Biến thể</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                >
                  + Thêm biến thể
                </Button>
              </div>

              {form.watch("variants").map((_, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <FormField
                    control={form.control}
                    name={`variants.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        {index === 0 && <FormLabel className="sr-only">Tên biến thể</FormLabel>}
                        <FormControl>
                          <Input 
                            placeholder="Tên biến thể (không bắt buộc)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`variants.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        {index === 0 && <FormLabel className="sr-only">Số lượng</FormLabel>}
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            placeholder="Số lượng"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("variants").length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariant(index)}
                      className="mt-0"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !phaseId}
                className="flex-1"
              >
                {isSubmitting ? "Đang thêm..." : "Thêm sản phẩm"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}