import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToTPOS, generateTPOSExcel, type TPOSProductItem } from "@/lib/tpos-api";
import { formatVND } from "@/lib/currency-utils";

interface ExportTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TPOSProductItem[];
  onSuccess?: () => void;
}

export function ExportTPOSDialog({ open, onOpenChange, items, onSuccess }: ExportTPOSDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  const itemsWithImages = items.filter(
    (item) => item.product_images && item.product_images.length > 0
  );
  const itemsWithoutImages = items.filter(
    (item) => !item.product_images || item.product_images.length === 0
  );

  const handleDownloadExcel = () => {
    try {
      const excelBlob = generateTPOSExcel(items);
      const url = URL.createObjectURL(excelBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TPOS_Export_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Thành công",
        description: "Đã tải xuống file Excel",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tạo file Excel",
        variant: "destructive",
      });
    }
  };

  const handleUploadToTPOS = async () => {
    setIsUploading(true);
    setProgress(0);
    setCurrentStep("Đang bắt đầu...");

    try {
      const result = await uploadToTPOS(items, (step, total, message) => {
        setProgress((step / total) * 100);
        setCurrentStep(message);
      });

      // Save TPOS IDs to Supabase
      if (result.productIds.length > 0) {
        for (const { itemId, tposId } of result.productIds) {
          await supabase
            .from("purchase_order_items")
            .update({ tpos_product_id: tposId })
            .eq("id", itemId);
        }
        result.savedIds = result.productIds.length;
      }

      toast({
        title: "Hoàn thành",
        description: (
          <div className="space-y-1">
            <p>✅ Thành công: {result.successCount}/{result.totalProducts}</p>
            <p>💾 Đã lưu IDs: {result.savedIds}</p>
            {result.failedCount > 0 && (
              <p className="text-destructive">❌ Thất bại: {result.failedCount}</p>
            )}
          </div>
        ),
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể upload lên TPOS",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export & Upload lên TPOS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Tổng sản phẩm</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Có hình ảnh</p>
              <p className="text-2xl font-bold text-green-600">{itemsWithImages.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Không có ảnh</p>
              <p className="text-2xl font-bold text-orange-600">{itemsWithoutImages.length}</p>
            </div>
          </div>

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{currentStep}</span>
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Preview Table */}
          <div className="border rounded-lg">
            <div className="p-3 bg-muted border-b">
              <h3 className="font-semibold">Preview (10 sản phẩm đầu)</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã SP</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Biến thể</TableHead>
                  <TableHead className="text-right">Giá bán</TableHead>
                  <TableHead>Hình ảnh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.slice(0, 10).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      {item.product_code || "AUTO"}
                    </TableCell>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>
                      {item.variant && (
                        <Badge variant="secondary">{item.variant}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVND(item.selling_price || 0)}
                    </TableCell>
                    <TableCell>
                      {item.product_images && item.product_images.length > 0 ? (
                        <Badge variant="default" className="bg-green-600">
                          ✓ {item.product_images.length}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Không có</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {items.length > 10 && (
              <div className="p-3 bg-muted border-t text-center text-sm text-muted-foreground">
                ... và {items.length - 10} sản phẩm khác
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Hủy
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadExcel}
            disabled={isUploading}
          >
            <Download className="h-4 w-4 mr-2" />
            Chỉ tải Excel
          </Button>
          <Button
            onClick={handleUploadToTPOS}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload lên TPOS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
