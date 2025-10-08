import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BaseProductData {
  product_code: string;
  product_name: string;
  variant: string | null;
  purchase_price: number;
  selling_price: number;
  supplier_name?: string;
  stock_quantity: number;
  product_images: string[];
  price_images: string[];
}

interface CreateVariantInput {
  baseProduct: BaseProductData;
}

// Helper function to merge and deduplicate variants
function mergeVariants(oldVariant: string | null, newVariant: string | null): string | null {
  if (!newVariant) return oldVariant;
  if (!oldVariant) return newVariant;
  
  // Split, combine, deduplicate, and sort
  const oldParts = oldVariant.split(',').map(s => s.trim()).filter(Boolean);
  const newParts = newVariant.split(',').map(s => s.trim()).filter(Boolean);
  const combined = [...new Set([...oldParts, ...newParts])];
  
  return combined.sort().join(', ');
}

export function useCreateVariantProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVariantInput) => {
      const { baseProduct } = input;

      // Check if base product exists
      const { data: existing } = await supabase
        .from("products")
        .select("*")
        .eq("product_code", baseProduct.product_code)
        .maybeSingle();

      if (existing) {
        // UPDATE only product_images and variant
        const mergedVariant = mergeVariants(existing.variant, baseProduct.variant);
        
        const { data, error } = await supabase
          .from("products")
          .update({
            product_images: baseProduct.product_images,
            variant: mergedVariant
          })
          .eq("product_code", baseProduct.product_code)
          .select()
          .single();

        if (error) throw error;
        return { action: 'updated' as const, product: data };
      } else {
        // INSERT with full data
        const { data, error } = await supabase
          .from("products")
          .insert({
            product_code: baseProduct.product_code,
            product_name: baseProduct.product_name,
            variant: baseProduct.variant,
            purchase_price: baseProduct.purchase_price,
            selling_price: baseProduct.selling_price,
            supplier_name: baseProduct.supplier_name || null,
            stock_quantity: baseProduct.stock_quantity,
            unit: "Cái",
            product_images: baseProduct.product_images,
            price_images: baseProduct.price_images
          })
          .select()
          .single();

        if (error) throw error;
        return { action: 'created' as const, product: data };
      }
    },
    onSuccess: ({ action, product }) => {
      const actionText = action === 'created' ? 'tạo' : 'cập nhật';
      toast({
        title: `Đã ${actionText} sản phẩm gốc`,
        description: `${product.product_code} - ${product.product_name}`
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi xử lý sản phẩm",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}
