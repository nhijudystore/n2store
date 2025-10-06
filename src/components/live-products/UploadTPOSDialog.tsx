import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { getActiveTPOSToken, getTPOSHeaders } from "@/lib/tpos-config";

interface UploadTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onUploadComplete: () => void;
}

interface OrderToUpload {
  order_code: string;
  tpos_order_id: string | null;
  code_tpos_order_id: string | null;
  upload_status: string | null;
  product_count: number;
  total_quantity: number;
}

export function UploadTPOSDialog({ open, onOpenChange, sessionId, onUploadComplete }: UploadTPOSDialogProps) {
  const [selectedOrderCodes, setSelectedOrderCodes] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const queryClient = useQueryClient();

  // Fetch orders with code_tpos_order_id
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['upload-tpos-orders', sessionId],
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from('live_orders')
        .select('order_code, tpos_order_id, code_tpos_order_id, upload_status, quantity')
        .eq('live_session_id', sessionId)
        .not('code_tpos_order_id', 'is', null);

      if (error) throw error;

      // Group by order_code and calculate stats
      const groupedOrders = ordersData.reduce((acc, order) => {
        if (!acc[order.order_code]) {
          acc[order.order_code] = {
            order_code: order.order_code,
            tpos_order_id: order.tpos_order_id,
            code_tpos_order_id: order.code_tpos_order_id,
            upload_status: order.upload_status,
            product_count: 0,
            total_quantity: 0,
          };
        }
        acc[order.order_code].product_count += 1;
        acc[order.order_code].total_quantity += order.quantity;
        return acc;
      }, {} as Record<string, OrderToUpload>);

      return Object.values(groupedOrders);
    },
    enabled: open && !!sessionId,
  });

  // Reset selection when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedOrderCodes(new Set());
      setUploadProgress({ current: 0, total: 0 });
    }
  }, [open]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrderCodes(new Set(orders.map(o => o.order_code)));
    } else {
      setSelectedOrderCodes(new Set());
    }
  };

  const handleSelectOrder = (orderCode: string, checked: boolean) => {
    const newSelection = new Set(selectedOrderCodes);
    if (checked) {
      newSelection.add(orderCode);
    } else {
      newSelection.delete(orderCode);
    }
    setSelectedOrderCodes(newSelection);
  };

  const handleUploadSelected = async () => {
    if (selectedOrderCodes.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 đơn hàng");
      return;
    }

    setIsUploading(true);
    const ordersToUpload = Array.from(selectedOrderCodes);
    setUploadProgress({ current: 0, total: ordersToUpload.length });

    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Không tìm thấy TPOS Bearer Token");
      }

      for (let i = 0; i < ordersToUpload.length; i++) {
        const orderCode = ordersToUpload[i];
        setUploadProgress({ current: i + 1, total: ordersToUpload.length });

        try {
          // BƯỚC 1: Lấy code_tpos_order_id
        const { data: orderData, error: orderError } = await supabase
          .from('live_orders')
          .select('code_tpos_order_id, id')
          .eq('order_code', orderCode)
          .limit(1)
          .maybeSingle();

          if (orderError) throw orderError;
          if (!orderData.code_tpos_order_id) {
            throw new Error("Không tìm thấy code_tpos_order_id");
          }

          const orderId = orderData.code_tpos_order_id;

          // BƯỚC 2: GET từ TPOS
          const getResponse = await fetch(
            `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})?$expand=Details,Partner,User,CRMTeam`,
            { 
              method: 'GET',
              headers: getTPOSHeaders(token) 
            }
          );

          if (!getResponse.ok) {
            const errorText = await getResponse.text();
            throw new Error(`GET failed (${getResponse.status}): ${errorText}`);
          }

          const currentOrderData = await getResponse.json();

          // BƯỚC 3: Lấy products từ DB
          const { data: liveOrdersData, error: liveOrdersError } = await supabase
            .from('live_orders')
            .select(`
              quantity,
              live_products!inner(
                product_code,
                product_name
              )
            `)
            .eq('order_code', orderCode);

          if (liveOrdersError) throw liveOrdersError;

          // Lấy product_code để query products table
          const productCodes = liveOrdersData.map(p => p.live_products.product_code);
          const { data: dbProducts, error: dbProductsError } = await supabase
            .from('products')
            .select('product_code, productid_bienthe, product_name, selling_price')
            .in('product_code', productCodes);

          if (dbProductsError) throw dbProductsError;

          // Validate tất cả products có productid_bienthe
          const missingVariants = dbProducts.filter(p => !p.productid_bienthe);
          if (missingVariants.length > 0) {
            throw new Error(
              `Các sản phẩm sau chưa có mã biến thể: ${missingVariants.map(p => p.product_code).join(', ')}`
            );
          }

          // Map data để tạo Details array
          const detailsArray = liveOrdersData.map(liveOrder => {
            const product = dbProducts.find(
              db => db.product_code === liveOrder.live_products.product_code
            );
            
            if (!product) {
              throw new Error(`Không tìm thấy sản phẩm ${liveOrder.live_products.product_code}`);
            }

            return {
              ProductId: product.productid_bienthe,
              ProductName: product.product_name,
              ProductNameGet: `[${product.product_code}] ${product.product_name}`,
              UOMId: 1,
              UOMName: "Cái",
              Quantity: liveOrder.quantity,
              Price: product.selling_price || 0,
              Factor: 1,
              ProductWeight: 0
            };
          });

          // BƯỚC 4: Tạo PUT payload - CHỈ chứa sản phẩm mới từ DB
          const updatePayload = {
            ...currentOrderData,
            PrintCount: (currentOrderData.PrintCount || 0) + 1,
            UserName: "nv20",
            Details: detailsArray // CHỈ sản phẩm mới
          };

          // Xóa @odata.context
          delete updatePayload['@odata.context'];

          // BƯỚC 5: PUT lên TPOS
          const putResponse = await fetch(
            `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})`,
            {
              method: 'PUT',
              headers: getTPOSHeaders(token),
              body: JSON.stringify(updatePayload)
            }
          );

          if (!putResponse.ok) {
            const errorText = await putResponse.text();
            throw new Error(`PUT failed (${putResponse.status}): ${errorText}`);
          }

          // BƯỚC 6: Update DB - SUCCESS
          const { error: updateError } = await supabase
            .from('live_orders')
            .update({
              uploaded_at: new Date().toISOString(),
              upload_status: 'success'
            })
            .eq('order_code', orderCode);

          if (updateError) throw updateError;

          // Log activity (activity_logs trigger will handle this automatically)

          console.log(`✅ Upload thành công đơn ${orderCode}`);

        } catch (error) {
          // XỬ LÝ LỖI: DỪNG HẲN
          console.error(`❌ Lỗi upload đơn ${orderCode}:`, error);
          toast.error(`Lỗi upload đơn ${orderCode}: ${error.message}`);

          await supabase
            .from('live_orders')
            .update({ upload_status: 'failed' })
            .eq('order_code', orderCode);

          setIsUploading(false);
          queryClient.invalidateQueries({ queryKey: ['upload-tpos-orders'] });
          return; // DỪNG BATCH
        }
      }

      // SUCCESS - Upload hết tất cả
      toast.success(`✅ Upload thành công ${ordersToUpload.length} đơn hàng!`);
      queryClient.invalidateQueries({ queryKey: ['upload-tpos-orders'] });
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      onUploadComplete();
      
    } catch (error) {
      console.error("❌ Lỗi upload:", error);
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const allSelected = orders.length > 0 && selectedOrderCodes.size === orders.length;
  const someSelected = selectedOrderCodes.size > 0 && selectedOrderCodes.size < orders.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Upload Orders lên TPOS</DialogTitle>
        </DialogHeader>

        {isUploading && (
          <div className="py-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Đang upload đơn {uploadProgress.current}/{uploadProgress.total}...
            </p>
          </div>
        )}

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có đơn hàng nào để upload (cần có Mã Order ID)
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allSelected || someSelected}
                      onCheckedChange={handleSelectAll}
                      disabled={isUploading}
                    />
                  </TableHead>
                  <TableHead>Mã đơn hàng</TableHead>
                  <TableHead>Mã TPOS</TableHead>
                  <TableHead>Mã Order ID</TableHead>
                  <TableHead className="text-right">Số SP</TableHead>
                  <TableHead className="text-right">Tổng SL</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.order_code}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrderCodes.has(order.order_code)}
                        onCheckedChange={(checked) =>
                          handleSelectOrder(order.order_code, checked as boolean)
                        }
                        disabled={isUploading}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{order.order_code}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {order.tpos_order_id || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {order.code_tpos_order_id || '-'}
                    </TableCell>
                    <TableCell className="text-right">{order.product_count}</TableCell>
                    <TableCell className="text-right">{order.total_quantity}</TableCell>
                    <TableCell>
                      {order.upload_status === 'success' && (
                        <Badge variant="default" className="bg-green-600">Đã upload</Badge>
                      )}
                      {order.upload_status === 'failed' && (
                        <Badge variant="destructive">Lỗi</Badge>
                      )}
                      {!order.upload_status && (
                        <Badge variant="outline">Chưa upload</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Hủy
          </Button>
          <Button 
            onClick={handleUploadSelected} 
            disabled={selectedOrderCodes.size === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload đã chọn ({selectedOrderCodes.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
