import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function TPOSImageCheck() {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();

  const checkTPOSImages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-tpos-images');
      
      if (error) throw error;
      
      setStats(data);
      toast({
        title: "Hoàn thành",
        description: `Đã kiểm tra ${data.total_products} sản phẩm từ TPOS`,
      });
    } catch (error: any) {
      console.error('Error checking TPOS images:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể kiểm tra TPOS",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-lg">
            <Image className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kiểm tra ảnh TPOS</h1>
            <p className="text-sm text-muted-foreground">
              Phân tích số lượng sản phẩm có ImgUrl trên TPOS
            </p>
          </div>
        </div>

        <Card className="p-6">
          <Button 
            onClick={checkTPOSImages} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Đang kiểm tra..." : "Bắt đầu kiểm tra"}
          </Button>
        </Card>

        {stats && (
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">Kết quả phân tích</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-sm text-muted-foreground">Tổng sản phẩm TPOS</div>
                <div className="text-2xl font-bold">{stats.total_products}</div>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-sm text-muted-foreground">Có ImgUrl (cả rỗng)</div>
                <div className="text-2xl font-bold">{stats.with_img_url}</div>
              </div>
              
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-sm text-muted-foreground">ImgUrl rỗng ("")</div>
                <div className="text-2xl font-bold">{stats.with_empty_img_url}</div>
              </div>
              
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-sm text-muted-foreground">Không có ảnh</div>
                <div className="text-2xl font-bold">{stats.without_any_image}</div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Chi tiết:</h3>
              <ul className="space-y-1 text-sm">
                <li>✓ Có ImgUrl hợp lệ: {stats.with_img_url - stats.with_empty_img_url}</li>
                <li>✓ Có Image field: {stats.with_image}</li>
                <li>✓ Có ImageUrl field: {stats.with_image_url}</li>
              </ul>
            </div>

            {stats.products_with_images && stats.products_with_images.length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">
                  Sản phẩm có hình ({stats.products_with_images.length} sản phẩm):
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {stats.products_with_images.slice(0, 50).map((product: any) => (
                    <div key={product.id} className="text-xs p-2 bg-muted rounded">
                      <div className="font-mono">{product.code}</div>
                      <div className="text-muted-foreground truncate">{product.name}</div>
                    </div>
                  ))}
                  {stats.products_with_images.length > 50 && (
                    <div className="text-xs text-muted-foreground italic">
                      ... và {stats.products_with_images.length - 50} sản phẩm khác
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
