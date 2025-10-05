import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTPOSHeaders } from "@/lib/tpos-config";

interface Order {
  order_code: string;
  tpos_order_id?: string | null;
  product_code: string;
  product_name: string;
  quantity: number;
  live_product_id: string;
}

interface UploadTposDialogProps {
  orders: Order[];
}

export function UploadTposDialog({ orders }: UploadTposDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  // Group orders by order_code and filter only those with tpos_order_id
  const ordersWithTpos = orders.filter(o => o.tpos_order_id);
  const orderGroups = ordersWithTpos.reduce((groups, order) => {
    if (!groups[order.order_code]) {
      groups[order.order_code] = {
        order_code: order.order_code,
        tpos_order_id: order.tpos_order_id!,
        items: []
      };
    }
    groups[order.order_code].items.push(order);
    return groups;
  }, {} as Record<string, { order_code: string; tpos_order_id: string; items: Order[] }>);

  const orderList = Object.values(orderGroups);

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
    if (selectedOrders.size === orderList.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orderList.map(o => o.order_code)));
    }
  };

  const handleUpload = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 đơn hàng");
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const selectedOrderList = orderList.filter(o => selectedOrders.has(o.order_code));

      for (const orderGroup of selectedOrderList) {
        try {
          // Build payload theo format TPOS
          const payload = {
            Details: orderGroup.items.map(item => ({
              // Note: ProductId cần được lấy từ TPOS, tạm thời skip nếu không có
              ProductName: item.product_name,
              Quantity: item.quantity,
              Price: 0, // Cần lấy giá từ database nếu có
              UOMName: "Cái",
              Factor: 1,
              ProductWeight: 0
            }))
          };

          const response = await fetch(
            `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderGroup.tpos_order_id})`,
            {
              method: "PUT",
              headers: getTPOSHeaders(),
              body: JSON.stringify(payload)
            }
          );

          if (response.ok) {
            successCount++;
            
            // Scroll to the order row
            const orderRow = document.getElementById(orderGroup.tpos_order_id);
            if (orderRow) {
              orderRow.scrollIntoView({ behavior: "smooth", block: "center" });
              orderRow.classList.add("bg-green-100", "dark:bg-green-900");
              setTimeout(() => {
                orderRow.classList.remove("bg-green-100", "dark:bg-green-900");
              }, 2000);
            }
          } else {
            errorCount++;
            console.error(`Failed to upload order ${orderGroup.order_code}:`, await response.text());
          }
        } catch (error) {
          errorCount++;
          console.error(`Error uploading order ${orderGroup.order_code}:`, error);
        }
      }

      if (successCount > 0) {
        toast.success(`Đã upload ${successCount} đơn hàng thành công`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} đơn hàng upload thất bại`);
      }

      setSelectedOrders(new Set());
      setOpen(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Có lỗi xảy ra khi upload");
    } finally {
      setIsUploading(false);
    }
  };

  if (orderList.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload lên TPOS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Chọn đơn hàng upload lên TPOS</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedOrders.size === orderList.length && orderList.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Mã TPOS</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Tổng SL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderList.map((orderGroup) => {
                const totalQuantity = orderGroup.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <TableRow key={orderGroup.order_code}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.has(orderGroup.order_code)}
                        onCheckedChange={() => toggleOrder(orderGroup.order_code)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className="font-mono">{orderGroup.order_code}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground font-mono">
                        {orderGroup.tpos_order_id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {orderGroup.items.map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.product_name} ({item.product_code}) x{item.quantity}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {totalQuantity}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Đã chọn: {selectedOrders.size}/{orderList.length} đơn
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleUpload} disabled={isUploading || selectedOrders.size === 0}>
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload ({selectedOrders.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
