import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PurchaseOrderItem {
  product_name: string;
  product_code: string | null;
  variant: string | null;
  quantity: number;
  unit_price: number;
  selling_price: number;
  product_images: string[] | null;
  price_images: string[] | null;
}

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  total_amount: number;
  final_amount: number;
  discount_amount: number;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_id?: string | null;
  notes: string | null;
  invoice_date: string | null;
  invoice_images: string[] | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
}

interface ProductWithOrder extends PurchaseOrderItem {
  purchase_order_notes: string | null;
  order_date: string;
  supplier_name: string | null;
}

interface ProductsListProps {
  filteredOrders: PurchaseOrder[];
}

export const ProductsList = ({ filteredOrders }: ProductsListProps) => {
  // Flatten orders to get all products
  const products: ProductWithOrder[] = filteredOrders.flatMap(order =>
    (order.items || []).map(item => ({
      ...item,
      purchase_order_notes: order.notes,
      order_date: order.order_date,
      supplier_name: order.supplier_name,
    }))
  );

  const handleExportExcel = () => {
    try {
      const excelData = products.map((item) => ({
        "Loại sản phẩm": "Có thể lưu trữ",
        "Mã sản phẩm": String(item.product_code || ""),
        "Mã chốt đơn": undefined,
        "Tên sản phẩm": String(item.product_name || ""),
        "Giá bán": item.selling_price || 0,
        "Giá mua": item.unit_price || 0,
        "Đơn vị": "CÁI",
        "Nhóm sản phẩm": "QUẦN ÁO",
        "Mã vạch": String(item.product_code || ""),
        "Khối lượng": undefined,
        "Chiết khấu bán": undefined,
        "Chiết khấu mua": undefined,
        "Tồn kho": undefined,
        "Giá vốn": undefined,
        "Ghi chú": item.purchase_order_notes || undefined,
        "Cho phép bán ở công ty khác": "FALSE",
        "Thuộc tính": undefined,
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sản phẩm");

      const fileName = `san-pham-dat-hang-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success(`Đã xuất ${products.length} sản phẩm ra file Excel`);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error("Có lỗi khi xuất file Excel");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Tổng số: <span className="font-semibold">{products.length}</span> sản phẩm
        </div>
        <Button onClick={handleExportExcel} className="gap-2">
          <Download className="w-4 h-4" />
          Xuất Excel
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã sản phẩm</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Biến thể</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
              <TableHead className="text-right">Giá mua</TableHead>
              <TableHead className="text-right">Giá bán</TableHead>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead>Ngày đặt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Không có sản phẩm nào
                </TableCell>
              </TableRow>
            ) : (
              products.map((product, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">
                    {product.product_code || "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {product.product_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.variant || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.quantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.unit_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.selling_price)}
                  </TableCell>
                  <TableCell>{product.supplier_name || "-"}</TableCell>
                  <TableCell>
                    {format(new Date(product.order_date), "dd/MM/yyyy")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
