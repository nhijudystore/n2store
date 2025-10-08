import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadToTPOS, TPOSProductItem } from "@/lib/tpos-api";

interface SimpleProductUploadDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export const SimpleProductUploadDialog = ({ 
  open, 
  onOpenChange,
  trigger 
}: SimpleProductUploadDialogProps) => {
  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: "JSON đã được sao chép vào clipboard",
    });
  };

  const handleReset = () => {
    setProductName("");
    setProductCode("");
    setPurchasePrice("");
    setSellingPrice("");
    setUploadResult(null);
    setIsResultOpen(false);
  };

  const handleUpload = async () => {
    // Validate inputs
    if (!productName.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập tên sản phẩm",
      });
      return;
    }
    
    if (!productCode.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập mã sản phẩm",
      });
      return;
    }
    
    const purchase = parseFloat(purchasePrice) || 0;
    const selling = parseFloat(sellingPrice) || 0;
    
    setIsUploading(true);
    setUploadResult(null);
    
    try {
      const item: TPOSProductItem = {
        id: crypto.randomUUID(),
        product_code: productCode.trim(),
        product_name: productName.trim(),
        variant: null, // Không có biến thể
        quantity: 1,
        unit_price: purchase,
        selling_price: selling,
        product_images: null,
        price_images: null,
        base_product_code: productCode.trim(),
        purchase_order_id: "",
        supplier_name: "Manual Upload",
      };
      
      const result = await uploadToTPOS([item], (step, total, message) => {
        console.log(`[${step}/${total}] ${message}`);
      });
      
      setUploadResult(result);
      setIsResultOpen(true);
      
      if (result.successCount > 0) {
        toast({
          title: "✅ Upload thành công",
          description: `Sản phẩm "${productName}" đã được upload lên TPOS`,
        });
        
        // Clear form after successful upload
        handleReset();
      } else {
        toast({
          variant: "destructive",
          title: "❌ Upload thất bại",
          description: result.errors[0]?.errorMessage || "Có lỗi xảy ra",
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi upload",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload sản phẩm đơn giản lên TPOS
          </DialogTitle>
          <DialogDescription>
            Upload sản phẩm không có biến thể lên hệ thống TPOS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">
              Tên sản phẩm <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Nhập tên sản phẩm..."
              disabled={isUploading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="product-code">
              Mã sản phẩm <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product-code"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="Nhập mã sản phẩm..."
              disabled={isUploading}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-price">Giá mua</Label>
              <Input
                id="purchase-price"
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0"
                disabled={isUploading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="selling-price">Giá bán</Label>
              <Input
                id="selling-price"
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0"
                disabled={isUploading}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleUpload}
              disabled={isUploading || !productName.trim() || !productCode.trim()}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang upload...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload lên TPOS
                </>
              )}
            </Button>
            
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={isUploading}
            >
              Reset
            </Button>
          </div>

          {uploadResult && (
            <Alert className="mt-4">
              {uploadResult.successCount > 0 ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {uploadResult.successCount > 0 ? "Upload thành công" : "Upload thất bại"}
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Thành công:</span>
                    <Badge variant={uploadResult.successCount > 0 ? "default" : "secondary"}>
                      {uploadResult.successCount}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Thất bại:</span>
                    <Badge variant={uploadResult.failedCount > 0 ? "destructive" : "secondary"}>
                      {uploadResult.failedCount}
                    </Badge>
                  </div>
                  {uploadResult.productIds.length > 0 && (
                    <div className="flex justify-between">
                      <span>TPOS Product ID:</span>
                      <Badge variant="outline">
                        {uploadResult.productIds[0].tposId}
                      </Badge>
                    </div>
                  )}
                  {uploadResult.errors.length > 0 && (
                    <div className="mt-2 text-destructive text-xs">
                      Lỗi: {uploadResult.errors[0].errorMessage}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {uploadResult && (
            <Collapsible open={isResultOpen} onOpenChange={setIsResultOpen}>
              <Card className="border-dashed">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                      {isResultOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Upload Result:</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(JSON.stringify(uploadResult, null, 2))}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                      {JSON.stringify(uploadResult, null, 2)}
                    </pre>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
