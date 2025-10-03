import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportProductsDialog({ open, onOpenChange, onSuccess }: ImportProductsDialogProps) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const parsePrice = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[,.\s]/g, "");
      return parseFloat(cleaned) || 0;
    }
    return 0;
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file Excel",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Get existing product codes
      const { data: existingProducts } = await supabase
        .from("products")
        .select("product_code");

      const existingCodes = new Set(existingProducts?.map((p) => p.product_code) || []);

      let insertedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];

        const productCode = row["Mã sản phẩm"]?.toString().trim();
        
        if (!productCode) {
          skippedCount++;
          continue;
        }

        // Skip if product code already exists
        if (existingCodes.has(productCode)) {
          skippedCount++;
          setProgress(((i + 1) / jsonData.length) * 100);
          continue;
        }

        const productData = {
          product_code: productCode,
          product_name: row["Tên sản phẩm"]?.toString().trim() || "Chưa có tên",
          selling_price: parsePrice(row["Giá bán"]),
          purchase_price: parsePrice(row["Giá mua"]),
          unit: row["Đơn vị"]?.toString().trim() || "Cái",
          category: row["Nhóm sản phẩm"]?.toString().trim() || null,
          barcode: row["Mã vạch"]?.toString().trim() || null,
          stock_quantity: parseInt(row["Số lượng tồn"]?.toString() || "0") || 0,
        };

        const { error } = await supabase.from("products").insert(productData);

        if (!error) {
          insertedCount++;
        } else {
          skippedCount++;
        }

        setProgress(((i + 1) / jsonData.length) * 100);
      }

      toast({
        title: "Import thành công",
        description: `Đã thêm ${insertedCount} sản phẩm mới, bỏ qua ${skippedCount} sản phẩm`,
      });

      onSuccess();
      onOpenChange(false);
      setFile(null);
      setProgress(0);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể import file Excel",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import sản phẩm từ Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="excel-file">Chọn file Excel</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Cột cần có: Mã sản phẩm, Tên sản phẩm, Giá bán, Giá mua, Đơn vị, Nhóm sản phẩm, Mã vạch, Số lượng tồn
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ⚠️ Sản phẩm đã tồn tại (trùng mã) sẽ được BỎ QUA
            </p>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Đang import... {Math.round(progress)}%
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setFile(null);
                setProgress(0);
              }}
              disabled={isImporting}
            >
              Hủy
            </Button>
            <Button onClick={handleImport} disabled={!file || isImporting}>
              {isImporting ? "Đang import..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
