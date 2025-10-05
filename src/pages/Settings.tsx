import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const { toast } = useToast();

  const handleCheckImages = async () => {
    setIsChecking(true);
    setCheckResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-tpos-images');
      
      if (error) throw error;
      
      if (data.success) {
        setCheckResult(data);
        toast({
          title: "Kiểm tra hoàn tất",
          description: `Tìm thấy ${data.summary.total_tpos_products} sản phẩm từ TPOS`,
        });
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch (error: any) {
      console.error("Check images error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi kiểm tra",
        description: error.message === "Unauthorized" 
          ? "Token TPOS đã hết hạn. Vui lòng cập nhật token mới trong Secrets."
          : error.message,
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSyncImages = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-tpos-images');
      
      if (error) throw error;
      
      if (data.success) {
        setSyncResult(data);
        toast({
          title: "Đồng bộ thành công",
          description: `Đã cập nhật ${data.summary.updated} sản phẩm`,
        });
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch (error: any) {
      console.error("Sync images error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi đồng bộ",
        description: error.message === "Unauthorized"
          ? "Token TPOS đã hết hạn. Vui lòng cập nhật token mới trong Secrets."
          : error.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-muted-foreground mt-2">Quản lý các cài đặt hệ thống</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Quản lý ảnh TPOS
          </CardTitle>
          <CardDescription>
            Kiểm tra và đồng bộ hóa ảnh sản phẩm từ hệ thống TPOS về database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={handleCheckImages}
              disabled={isChecking || isSyncing}
              variant="outline"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang kiểm tra...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Kiểm tra ảnh TPOS
                </>
              )}
            </Button>

            <Button
              onClick={handleSyncImages}
              disabled={isChecking || isSyncing}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang đồng bộ...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Đồng bộ ảnh TPOS
                </>
              )}
            </Button>
          </div>

          {checkResult && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Kết quả kiểm tra</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Tổng sản phẩm TPOS:</span>
                    <Badge variant="secondary">{checkResult.summary.total_tpos_products}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Sản phẩm trong DB:</span>
                    <Badge variant="secondary">{checkResult.summary.total_db_products}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Thiếu ảnh:</span>
                    <Badge variant="destructive">{checkResult.summary.missing_images}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Không tìm thấy trong TPOS:</span>
                    <Badge variant="outline">{checkResult.summary.not_found_in_tpos}</Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {syncResult && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Kết quả đồng bộ</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Tổng sản phẩm xử lý:</span>
                    <Badge variant="secondary">{syncResult.summary.total_products}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Đã cập nhật:</span>
                    <Badge>{syncResult.summary.updated}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Không tìm thấy trong TPOS:</span>
                    <Badge variant="outline">{syncResult.summary.not_found_in_tpos}</Badge>
                  </div>
                  {syncResult.summary.errors > 0 && (
                    <div className="flex justify-between">
                      <span>Lỗi:</span>
                      <Badge variant="destructive">{syncResult.summary.errors}</Badge>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
