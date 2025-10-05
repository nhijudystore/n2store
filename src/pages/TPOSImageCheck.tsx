import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Image, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function TPOSImageCheck() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const { toast } = useToast();

  const checkTPOSImages = async () => {
    setIsLoading(true);
    setSyncResult(null);
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

  const syncTPOSImages = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-tpos-images');
      
      if (error) throw error;
      
      setSyncResult(data);
      toast({
        title: "Đồng bộ thành công",
        description: `Đã cập nhật ${data.updated} sản phẩm`,
      });
    } catch (error: any) {
      console.error('Error syncing TPOS images:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể đồng bộ TPOS",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
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
          <div className="flex gap-3">
            <Button 
              onClick={checkTPOSImages} 
              disabled={isLoading || isSyncing}
              className="flex-1"
              variant="outline"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Đang kiểm tra..." : "Kiểm tra ảnh TPOS"}
            </Button>
            
            <Button 
              onClick={syncTPOSImages} 
              disabled={isLoading || isSyncing}
              className="flex-1"
            >
              {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? "Đang đồng bộ..." : "Đồng bộ ImgUrl vào DB"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Đồng bộ sẽ cập nhật ImgUrl từ TPOS vào cột hình ảnh trong /products theo mã SP
          </p>
        </Card>

        {syncResult && (
          <Card className="p-6 space-y-4 border-green-500">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-600" />
              Kết quả đồng bộ
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-sm text-muted-foreground">Tổng SP TPOS</div>
                <div className="text-2xl font-bold">{syncResult.tpos_products_total}</div>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-sm text-muted-foreground">TPOS có ảnh</div>
                <div className="text-2xl font-bold">{syncResult.tpos_products_with_images}</div>
              </div>
              
              <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-sm text-muted-foreground">Tổng SP Database</div>
                <div className="text-2xl font-bold">{syncResult.database_products_total}</div>
              </div>
              
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-sm text-muted-foreground">Khớp mã SP</div>
                <div className="text-2xl font-bold">{syncResult.matched_by_code}</div>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg col-span-2">
                <div className="text-sm text-muted-foreground">Đã cập nhật ImgUrl</div>
                <div className="text-3xl font-bold text-green-600">{syncResult.updated}</div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Chi tiết:</h3>
              <ul className="space-y-1 text-sm">
                <li>✓ Đã cập nhật: {syncResult.updated} sản phẩm</li>
                <li>→ Bỏ qua (không đổi): {syncResult.skipped_unchanged} sản phẩm</li>
                <li>✗ Không tìm thấy trên TPOS: {syncResult.not_found_in_tpos} sản phẩm</li>
              </ul>
            </div>
          </Card>
        )}

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
