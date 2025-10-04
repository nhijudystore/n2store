import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductStats } from "@/components/products/ProductStats";
import { ProductList } from "@/components/products/ProductList";
import { CreateProductDialog } from "@/components/products/CreateProductDialog";
import { ImportProductsDialog } from "@/components/products/ImportProductsDialog";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Products() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10000);

      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category")
        .not("category", "is", null)
        .limit(10000);

      if (error) throw error;
      
      const uniqueCategories = [...new Set(data.map(p => p.category))].filter(Boolean);
      return uniqueCategories as string[];
    },
  });

  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      product.product_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;

    return matchesSearch && matchesCategory;
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

        {/* Stats */}
        {!isMobile && <ProductStats products={products} />}

        {/* Filters & Actions */}
        <Card className="p-4">
          <div className={`flex ${isMobile ? "flex-col" : "flex-row items-center"} gap-4`}>
            <Input
              placeholder="Tìm kiếm theo mã SP, tên, mã vạch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className={isMobile ? "w-full" : "w-[200px]"}>
                <SelectValue placeholder="Nhóm sản phẩm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
        </Card>

        {/* Product List */}
        <ProductList
          products={filteredProducts}
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
