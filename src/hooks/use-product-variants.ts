import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductVariant {
  id: string;
  product_code: string;
  product_name: string;
  variant: string;
}

export function useProductVariants(baseProductCode: string) {
  return useQuery({
    queryKey: ["product-variants", baseProductCode],
    queryFn: async () => {
      if (!baseProductCode || baseProductCode.trim().length === 0) {
        return [];
      }
      
      const { data, error } = await supabase
        .from("products")
        .select("id, product_code, product_name, variant")
        .ilike("product_code", `${baseProductCode}%`)
        .not("variant", "is", null)
        .order("product_code");
      
      if (error) throw error;
      return (data || []) as ProductVariant[];
    },
    enabled: baseProductCode.trim().length > 0
  });
}
