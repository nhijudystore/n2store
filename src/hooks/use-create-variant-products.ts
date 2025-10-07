import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface VariantProductData {
  product_code: string;
  product_name: string;
  variant: string;
  purchase_price: number;
  selling_price: number;
  supplier_name?: string;
  stock_quantity?: number;
  product_images?: string[];
  price_images?: string[];
}

export function useCreateVariantProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: VariantProductData[]) => {
      // Check for existing product codes
      const codes = products.map(p => p.product_code);
      const { data: existingProducts } = await supabase
        .from("products")
        .select("product_code")
        .in("product_code", codes);

      const existingCodes = existingProducts?.map(p => p.product_code) || [];
      if (existingCodes.length > 0) {
        throw new Error(`Mã sản phẩm đã tồn tại: ${existingCodes.join(", ")}`);
      }

      // Insert products
      const { data, error } = await supabase
        .from("products")
        .insert(
          products.map(p => ({
            product_code: p.product_code,
            product_name: p.product_name,
            variant: p.variant,
            purchase_price: p.purchase_price,
            selling_price: p.selling_price,
            supplier_name: p.supplier_name || null,
            stock_quantity: p.stock_quantity || 0,
            unit: "Cái",
            product_images: p.product_images || [],
            price_images: p.price_images || []
          }))
        )
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Đã tạo sản phẩm biến thể",
        description: `Đã tạo ${data.length} sản phẩm vào kho hàng`
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi tạo sản phẩm",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}
