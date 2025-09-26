import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar,
  Filter,
  Download,
  Search,
  Eye,
  Image as ImageIcon,
  Receipt,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package2
} from "lucide-react";

// Mock data based on the uploaded images
const mockSupplierOrders = [
  {
    id: "ORD001",
    date: "26/09/2024",
    supplier: "Shop của Nhi",
    productCode: "SP001",
    productName: "Áo polo nam",
    variant: "Size M, Màu xanh",
    quantity: 2,
    unitPrice: 250000,
    totalPrice: 500000,
    profit: 150000,
    customerName: "Nguyễn Văn A",
    customerPhone: "0987654321",
    paymentMethod: "Chuyển khoản",
    status: "Đã giao",
    invoiceImage: "/api/placeholder/40/40",
    productImage: "/api/placeholder/40/40"
  },
  {
    id: "ORD002", 
    date: "26/09/2024",
    supplier: "Ánh Shoes",
    productCode: "SP002",
    productName: "Giày sneaker nữ",
    variant: "Size 37, Màu trắng",
    quantity: 1,
    unitPrice: 890000,
    totalPrice: 890000,
    profit: 200000,
    customerName: "Trần Thị B",
    customerPhone: "0912345678",
    paymentMethod: "Tiền mặt",
    status: "Đã giao",
    invoiceImage: "/api/placeholder/40/40",
    productImage: "/api/placeholder/40/40"
  },
  {
    id: "ORD003",
    date: "25/09/2024", 
    supplier: "An Shop",
    productCode: "SP003",
    productName: "Túi xách nữ",
    variant: "Màu đen, Da thật",
    quantity: 1,
    unitPrice: 1200000,
    totalPrice: 1200000,
    profit: 350000,
    customerName: "Lê Thị C",
    customerPhone: "0965432187",
    paymentMethod: "Chuyển khoản",
    status: "Đang giao",
    invoiceImage: "/api/placeholder/40/40",
    productImage: "/api/placeholder/40/40"
  },
  {
    id: "ORD004",
    date: "25/09/2024",
    supplier: "Shop Tết",
    productCode: "SP004", 
    productName: "Áo khoác nữ",
    variant: "Size L, Màu hồng",
    quantity: 1,
    unitPrice: 450000,
    totalPrice: 450000,
    profit: 120000,
    customerName: "Phạm Văn D",
    customerPhone: "0934567890",
    paymentMethod: "COD",
    status: "Chờ xử lý",
    invoiceImage: "/api/placeholder/40/40",
    productImage: "/api/placeholder/40/40"
  },
  {
    id: "ORD005",
    date: "24/09/2024",
    supplier: "Beauty Corner",
    productCode: "SP005",
    productName: "Váy dài nữ",
    variant: "Size S, Màu đỏ",
    quantity: 2,
    unitPrice: 320000,
    totalPrice: 640000,
    profit: 180000,
    customerName: "Võ Thị E",
    customerPhone: "0901234567",
    paymentMethod: "Chuyển khoản",
    status: "Đã giao",
    invoiceImage: "/api/placeholder/40/40",
    productImage: "/api/placeholder/40/40"
  }
];

const suppliers = ["Tất cả", "Shop của Nhi", "Ánh Shoes", "An Shop", "Shop Tết", "Beauty Corner"];

const SupplierOrderStats = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("Tất cả");
  const [selectedStatus, setSelectedStatus] = useState("Tất cả");

  const filteredOrders = mockSupplierOrders.filter(order => {
    const matchesSearch = order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSupplier = selectedSupplier === "Tất cả" || order.supplier === selectedSupplier;
    const matchesStatus = selectedStatus === "Tất cả" || order.status === selectedStatus;
    
    return matchesSearch && matchesSupplier && matchesStatus;
  });

  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0);
  const totalProfit = filteredOrders.reduce((sum, order) => sum + order.profit, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Đã giao":
        return <Badge className="bg-success/10 text-success hover:bg-success/20">Đã giao</Badge>;
      case "Đang giao":
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Đang giao</Badge>;
      case "Chờ xử lý":
        return <Badge className="bg-muted text-muted-foreground">Chờ xử lý</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Thống Kê Đơn Hàng Theo Nhà Cung Cấp</h2>
          <p className="text-muted-foreground">Chi tiết đơn hàng từ các nhà cung cấp theo ngày</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Chọn thời gian
          </Button>
          <Button className="bg-gradient-primary hover:opacity-90">
            <Download className="w-4 h-4 mr-2" />
            Xuất Excel
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Tổng đơn hàng</p>
                <p className="text-xl font-bold">{totalOrders}</p>
              </div>
              <ShoppingCart className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Tổng doanh thu</p>
                <p className="text-xl font-bold">₫{totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Tổng lợi nhuận</p>
                <p className="text-xl font-bold">₫{totalProfit.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Giá trị TB/đơn</p>
                <p className="text-xl font-bold">₫{Math.round(avgOrderValue).toLocaleString()}</p>
              </div>
              <Package2 className="w-6 h-6 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm sản phẩm, mã SP, tên khách hàng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Chọn nhà cung cấp" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tất cả">Tất cả</SelectItem>
                <SelectItem value="Đã giao">Đã giao</SelectItem>
                <SelectItem value="Đang giao">Đang giao</SelectItem>
                <SelectItem value="Chờ xử lý">Chờ xử lý</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="shadow-soft">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Mã ĐH</TableHead>
                  <TableHead className="w-24">Ngày</TableHead>
                  <TableHead>Nhà Cung Cấp</TableHead>
                  <TableHead>Mã SP</TableHead>
                  <TableHead>Tên Sản Phẩm</TableHead>
                  <TableHead>Biến thể</TableHead>
                  <TableHead className="w-16">SL</TableHead>
                  <TableHead>Giá</TableHead>
                  <TableHead>Thành tiền</TableHead>
                  <TableHead>Lợi nhuận</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ảnh HĐ</TableHead>
                  <TableHead>Ảnh SP</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell className="font-medium">{order.supplier}</TableCell>
                    <TableCell>{order.productCode}</TableCell>
                    <TableCell className="max-w-32 truncate">{order.productName}</TableCell>
                    <TableCell className="max-w-28 truncate text-sm text-muted-foreground">
                      {order.variant}
                    </TableCell>
                    <TableCell className="text-center">{order.quantity}</TableCell>
                    <TableCell>₫{order.unitPrice.toLocaleString()}</TableCell>
                    <TableCell className="font-medium">₫{order.totalPrice.toLocaleString()}</TableCell>
                    <TableCell className="text-success font-medium">
                      +₫{order.profit.toLocaleString()}
                    </TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>{order.customerPhone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{order.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="w-8 h-8 bg-muted rounded border flex items-center justify-center">
                        <Receipt className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-8 h-8 bg-muted rounded border flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierOrderStats;