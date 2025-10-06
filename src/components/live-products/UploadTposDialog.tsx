import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { uploadOrderToTPOS, type UploadResult } from "@/lib/tpos-order-uploader";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Order {
  order_code: string;
  tpos_order_id?: string | null;
  code_tpos_oder_id?: string | null;
  product_code: string;
  product_name: string;
  quantity: number;
  live_product_id: string;
  tpos_product_id?: number;
  selling_price?: number;
}

interface UploadTposDialogProps {
  orders: Order[];
}

export function UploadTposDialog({ orders }: UploadTposDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [progress, setProgress] = useState(0);

  // Filter orders that have TPOS ID (use code_tpos_oder_id as primary, fallback to tpos_order_id)
  const ordersWithTpos = orders.filter(order => order.code_tpos_oder_id || order.tpos_order_id);

  // Group by order_code
  const orderGroups = Array.from(
    ordersWithTpos.reduce((groups, order) => {
      if (!groups.has(order.order_code)) {
        groups.set(order.order_code, []);
      }
      groups.get(order.order_code)!.push(order);
      return groups;
    }, new Map<string, Order[]>())
  );

  const toggleOrder = (orderCode: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderCode)) {
      newSelected.delete(orderCode);
    } else {
      newSelected.add(orderCode);
    }
    setSelectedOrders(newSelected);
  };

  const toggleAll = () => {
    if (selectedOrders.size === orderGroups.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orderGroups.map(([code]) => code)));
    }
  };

  const handleUpload = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Vui lòng chọn ít nhất một đơn hàng để upload");
      return;
    }

    setIsUploading(true);
    setUploadResults([]);
    setProgress(0);

    try {
      const ordersToUpload = ordersWithTpos.filter(order => 
        selectedOrders.has(order.order_code)
      );

      const results: UploadResult[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < ordersToUpload.length; i++) {
        const order = ordersToUpload[i];
        const tposOrderId = order.code_tpos_oder_id || order.tpos_order_id;

        if (!tposOrderId) {
          results.push({
            success: false,
            orderId: order.order_code,
            message: "Không có TPOS Order ID",
            error: "Missing TPOS Order ID"
          });
          errorCount++;
          continue;
        }

        try {
          const result = await uploadOrderToTPOS({
            tpos_order_id: tposOrderId,
            product_code: order.product_code,
            product_name: order.product_name,
            quantity: order.quantity,
            tpos_product_id: order.tpos_product_id,
            selling_price: order.selling_price,
          });

          results.push(result);
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error: any) {
          results.push({
            success: false,
            orderId: tposOrderId,
            message: "Lỗi upload",
            error: error.message
          });
          errorCount++;
        }

        // Update progress
        setProgress(((i + 1) / ordersToUpload.length) * 100);
        setUploadResults([...results]);
      }

      // Show final toast
      if (errorCount === 0) {
        toast.success(`✅ Upload thành công ${successCount} đơn hàng`);
      } else if (successCount === 0) {
        toast.error(`❌ Upload thất bại ${errorCount} đơn hàng`);
      } else {
        toast.warning(`⚠️ Hoàn thành: ${successCount} thành công, ${errorCount} lỗi`);
      }

    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (ordersWithTpos.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload lên TPOS ({ordersWithTpos.length})
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Upload đơn hàng lên TPOS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Tổng đơn hàng</p>
              <p className="text-2xl font-bold">{ordersWithTpos.length}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Đã chọn</p>
              <p className="text-2xl font-bold">{selectedOrders.size}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Tiến độ</p>
              <p className="text-2xl font-bold">{Math.round(progress)}%</p>
            </div>
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Đang upload {uploadResults.length}/{selectedOrders.size} đơn hàng...
              </p>
            </div>
          )}

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <ScrollArea className="h-48 border rounded-lg p-4">
              <div className="space-y-2">
                {uploadResults.map((result, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center gap-2 p-2 rounded ${
                      result.success ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order ID: {result.orderId}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.success ? result.message : result.error}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Orders Table */}
          <ScrollArea className="h-64 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedOrders.size === orderGroups.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                      disabled={isUploading}
                    />
                  </TableHead>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>TPOS Order ID</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>SL</TableHead>
                  <TableHead>TPOS Product ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderGroups.map(([orderCode, groupOrders]) => (
                  <TableRow key={orderCode}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(orderCode)}
                        onChange={() => toggleOrder(orderCode)}
                        className="rounded border-gray-300"
                        disabled={isUploading}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{orderCode}</TableCell>
                    <TableCell className="text-sm">
                      {groupOrders[0].code_tpos_oder_id || groupOrders[0].tpos_order_id}
                    </TableCell>
                    <TableCell>
                      {groupOrders.map(o => (
                        <div key={o.live_product_id} className="text-sm">
                          [{o.product_code}] {o.product_name}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      {groupOrders.map(o => (
                        <div key={o.live_product_id} className="text-sm">
                          {o.quantity}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      {groupOrders.map(o => (
                        <div key={o.live_product_id} className="text-sm">
                          {o.tpos_product_id || '-'}
                        </div>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              setOpen(false);
              setUploadResults([]);
              setProgress(0);
            }} 
            disabled={isUploading}
          >
            {isUploading ? "Đóng sau khi hoàn thành" : "Đóng"}
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={selectedOrders.size === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload ({selectedOrders.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
