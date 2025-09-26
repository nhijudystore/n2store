import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  MoreHorizontal,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Orders = () => {
  const orders = [
    {
      id: "#ĐH-2024-001",
      customer: "Nguyễn Văn An",
      email: "nguyenvanan@email.com",
      phone: "0901234567",
      products: 3,
      amount: "₫2,450,000",
      status: "completed",
      statusText: "Hoàn thành", 
      date: "15/03/2024 - 14:30",
      address: "123 Đường ABC, Q.1, TP.HCM"
    },
    {
      id: "#ĐH-2024-002",
      customer: "Trần Thị Bình",
      email: "tranthibinh@email.com", 
      phone: "0912345678",
      products: 2,
      amount: "₫1,890,000",
      status: "processing",
      statusText: "Đang xử lý",
      date: "15/03/2024 - 10:15",
      address: "456 Đường DEF, Q.3, TP.HCM"
    },
    {
      id: "#ĐH-2024-003",
      customer: "Lê Hoàng Cường",
      email: "lehoangcuong@email.com",
      phone: "0923456789", 
      products: 5,
      amount: "₫3,200,000",
      status: "pending",
      statusText: "Chờ thanh toán",
      date: "14/03/2024 - 16:45",
      address: "789 Đường GHI, Q.7, TP.HCM"
    },
    {
      id: "#ĐH-2024-004",
      customer: "Phạm Thu Hà",
      email: "phamthuha@email.com",
      phone: "0934567890",
      products: 1,
      amount: "₫980,000", 
      status: "shipping",
      statusText: "Đang giao hàng",
      date: "14/03/2024 - 09:20",
      address: "321 Đường JKL, Q.5, TP.HCM"
    },
    {
      id: "#ĐH-2024-005",
      customer: "Võ Minh Tuấn",
      email: "vominhtuan@email.com",
      phone: "0945678901",
      products: 4,
      amount: "₫4,150,000",
      status: "cancelled", 
      statusText: "Đã hủy",
      date: "13/03/2024 - 20:10",
      address: "654 Đường MNO, Q.10, TP.HCM"
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing': 
        return <Package className="w-4 h-4" />;
      case 'shipping':
        return <Truck className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary'; 
      case 'shipping':
        return 'outline';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-success bg-success/10';
      case 'processing':
        return 'text-primary bg-primary/10';
      case 'shipping': 
        return 'text-warning bg-warning/10';
      case 'pending':
        return 'text-muted-foreground bg-muted';
      case 'cancelled':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý đơn hàng</h1>
          <p className="text-muted-foreground mt-2">
            Theo dõi và xử lý tất cả đơn hàng từ khách hàng
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Tạo đơn hàng mới
        </Button>
      </div>

      {/* Filters */}
      <Card className="shadow-soft">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo mã đơn hàng, tên khách hàng..."
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Lọc
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Danh sách đơn hàng ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orders.map((order, index) => (
              <div key={index} className="p-4 border border-border rounded-lg hover:shadow-soft transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-card border flex items-center justify-center">
                      {getStatusIcon(order.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-lg">{order.id}</p>
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.statusText}
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">{order.date}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold">{order.amount}</p>
                    <p className="text-sm text-muted-foreground">{order.products} sản phẩm</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Khách hàng</p>
                    <p className="font-medium">{order.customer}</p>
                    <p className="text-muted-foreground">{order.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{order.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Địa chỉ giao hàng</p>
                    <p className="font-medium">{order.address}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Xem chi tiết
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Chỉnh sửa
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>In hóa đơn</DropdownMenuItem>
                      <DropdownMenuItem>Sao chép đơn hàng</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Hủy đơn hàng</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center mt-6">
            <Button variant="outline">Tải thêm đơn hàng</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Orders;