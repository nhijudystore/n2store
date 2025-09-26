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
  Users,
  Star,
  Phone,
  Mail,
  MapPin,
  ShoppingCart,
  Calendar
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Customers = () => {
  const customers = [
    {
      id: "KH001",
      name: "Nguyễn Văn An",
      email: "nguyenvanan@email.com",
      phone: "0901234567",
      address: "123 Đường ABC, Q.1, TP.HCM",
      totalOrders: 15,
      totalSpent: "₫45,890,000",
      lastOrder: "15/03/2024",
      status: "vip",
      statusText: "VIP",
      joinDate: "15/01/2023",
      rating: 5.0,
      avatar: "🧑‍💼"
    },
    {
      id: "KH002", 
      name: "Trần Thị Bình",
      email: "tranthibinh@email.com",
      phone: "0912345678",
      address: "456 Đường DEF, Q.3, TP.HCM",
      totalOrders: 8,
      totalSpent: "₫12,450,000",
      lastOrder: "14/03/2024",
      status: "regular",
      statusText: "Thường xuyên",
      joinDate: "20/05/2023",
      rating: 4.8,
      avatar: "👩‍💼"
    },
    {
      id: "KH003",
      name: "Lê Hoàng Cường",
      email: "lehoangcuong@email.com", 
      phone: "0923456789",
      address: "789 Đường GHI, Q.7, TP.HCM",
      totalOrders: 3,
      totalSpent: "₫8,900,000",
      lastOrder: "10/03/2024",
      status: "new",
      statusText: "Mới",
      joinDate: "01/02/2024",
      rating: 4.5,
      avatar: "👨‍💻"
    },
    {
      id: "KH004",
      name: "Phạm Thu Hà",
      email: "phamthuha@email.com",
      phone: "0934567890", 
      address: "321 Đường JKL, Q.5, TP.HCM",
      totalOrders: 22,
      totalSpent: "₫67,320,000",
      lastOrder: "13/03/2024",
      status: "vip",
      statusText: "VIP",
      joinDate: "10/08/2022",
      rating: 4.9,
      avatar: "👩‍🎨"
    },
    {
      id: "KH005",
      name: "Võ Minh Tuấn",
      email: "vominhtuan@email.com",
      phone: "0945678901",
      address: "654 Đường MNO, Q.10, TP.HCM", 
      totalOrders: 1,
      totalSpent: "₫2,150,000",
      lastOrder: "05/03/2024",
      status: "inactive",
      statusText: "Không hoạt động",
      joinDate: "25/01/2024",
      rating: 4.2,
      avatar: "👨‍🔧"
    },
    {
      id: "KH006",
      name: "Đỗ Minh Hạnh",
      email: "dominhanh@email.com",
      phone: "0956789012",
      address: "987 Đường PQR, Q.2, TP.HCM",
      totalOrders: 12,
      totalSpent: "₫28,750,000", 
      lastOrder: "12/03/2024",
      status: "regular",
      statusText: "Thường xuyên",
      joinDate: "15/11/2023",
      rating: 4.7,
      avatar: "👩‍🏫"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vip':
        return 'text-warning bg-warning/10 border-warning/20';
      case 'regular':
        return 'text-success bg-success/10 border-success/20';
      case 'new':
        return 'text-primary bg-primary/10 border-primary/20';
      case 'inactive':
        return 'text-muted-foreground bg-muted border-border';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  const stats = [
    {
      title: "Tổng khách hàng",
      value: customers.length.toString(),
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Khách VIP",
      value: customers.filter(c => c.status === 'vip').length.toString(),
      icon: Star,
      color: "text-warning", 
      bgColor: "bg-warning/10"
    },
    {
      title: "Khách mới tháng này",
      value: customers.filter(c => c.status === 'new').length.toString(),
      icon: Plus,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      title: "Không hoạt động",
      value: customers.filter(c => c.status === 'inactive').length.toString(),
      icon: Users,
      color: "text-muted-foreground",
      bgColor: "bg-muted"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý khách hàng</h1>
          <p className="text-muted-foreground mt-2">
            Quản lý thông tin và lịch sử mua hàng của khách hàng
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Thêm khách hàng
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="shadow-soft">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Tìm kiếm khách hàng theo tên, email, số điện thoại..."
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Lọc theo trạng thái
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {customers.map((customer, index) => (
          <Card key={index} className="shadow-soft hover:shadow-medium transition-all duration-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-card border flex items-center justify-center text-2xl">
                    {customer.avatar}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">ID: {customer.id}</p>
                  </div>
                </div>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(customer.status)}`}>
                  {customer.statusText}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="line-clamp-1">{customer.address}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Tổng đơn hàng</p>
                  <p className="font-semibold flex items-center gap-1">
                    <ShoppingCart className="w-4 h-4" />
                    {customer.totalOrders}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tổng chi tiêu</p>
                  <p className="font-semibold">{customer.totalSpent}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Đánh giá</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-warning text-warning" />
                    <span className="font-semibold">{customer.rating}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Đơn cuối</p>
                  <p className="font-medium text-sm">{customer.lastOrder}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Tham gia từ {customer.joinDate}</span>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="w-4 h-4 mr-2" />
                  Xem chi tiết
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
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
                    <DropdownMenuItem>Gửi email</DropdownMenuItem>
                    <DropdownMenuItem>Lịch sử đơn hàng</DropdownMenuItem>
                    <DropdownMenuItem>Tạo đơn hàng mới</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Khóa tài khoản</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center">
        <Button variant="outline">Tải thêm khách hàng</Button>
      </div>
    </div>
  );
};

export default Customers;