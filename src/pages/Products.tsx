import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductStats } from "@/components/products/ProductStats";
import { ProductList } from "@/components/products/ProductList";
import { CreateProductDialog } from "@/components/products/CreateProductDialog";
import { ImportProductsDialog } from "@/components/products/ImportProductsDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";

export default function Products() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Query for displayed products (search results or 50 latest)
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ["products-search", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      // If search query exists (>= 2 chars), search in database
      if (debouncedSearch.length >= 2) {
        query = query.or(
          `product_code.ilike.%${debouncedSearch}%,` +
          `product_name.ilike.%${debouncedSearch}%,` +
          `barcode.ilike.%${debouncedSearch}%`
        );
      } else {
        // Otherwise, load 50 latest products
        query = query.range(0, 49);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    gcTime: 60000,
  });

  // Query for total count
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["products-total-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60000,
  });

  // Query for ALL products for stats (Option B)
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products-all-for-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .range(0, 9999);
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className={`${isMobile ? "p-4 space-y-4" : "p-8 space-y-6"}`}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kho Sản Phẩm</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý tồn kho và thông tin sản phẩm
            </p>
          </div>
        </div>

        {/* Stats - Always show for entire database */}
        {!isMobile && <ProductStats products={allProducts} />}

        {/* Search & Actions */}
        <Card className="p-4 space-y-3">
          <div className={`flex ${isMobile ? "flex-col" : "flex-row items-center"} gap-4`}>
            <Input
              placeholder="Tìm kiếm theo mã SP, tên, mã vạch (tối thiểu 2 ký tự)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />

            <div className={`flex gap-2 ${isMobile ? "w-full" : ""}`}>
              <Button
                onClick={() => setIsImportDialogOpen(true)}
                variant="outline"
                className={isMobile ? "flex-1" : ""}
              >
                Import Excel
              </Button>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className={isMobile ? "flex-1" : ""}
              >
                Thêm SP
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {debouncedSearch.length >= 2 
              ? `Tìm thấy ${products.length} sản phẩm`
              : `Hiển thị ${products.length} sản phẩm mới nhất (Tổng ${totalCount})`
            }
          </div>
        </Card>

        {/* Product List */}
        <ProductList
          products={products}
          isLoading={isLoading}
          onRefetch={refetch}
        />

        {/* Dialogs */}
        <CreateProductDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={refetch}
        />
        
        <ImportProductsDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onSuccess={refetch}
        />
      </div>
    </div>
  );
}
