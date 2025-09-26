import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ShoppingCart, 
  Package, 
  Users, 
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

const Dashboard = () => {
  const stats = [
    {
      title: "Tổng doanh thu",
      value: "₫125,640,000",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      title: "Đơn hàng hôm nay", 
      value: "47",
      change: "+8.2%",
      trend: "up",
      icon: ShoppingCart,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Sản phẩm bán được",
      value: "1,248",
      change: "+23.1%", 
      trend: "up",
      icon: Package,
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      title: "Khách hàng mới",
      value: "89",
      change: "+5.4%",
      trend: "up", 
      icon: Users,
      color: "text-warning",
      bgColor: "bg-warning/10"
    }
  ];

  const recentOrders = [
    {
      id: "#ĐH-2024-001",
      customer: "Nguyễn Văn An",
      status: "Hoàn thành",
      amount: "₫2,450,000",
      date: "15/03/2024",
      statusColor: "text-success",
      statusBg: "bg-success/10"
    },
    {
      id: "#ĐH-2024-002", 
      customer: "Trần Thị Bình",
      status: "Đang xử lý",
      amount: "₫1,890,000",
      date: "15/03/2024",
      statusColor: "text-warning",
      statusBg: "bg-warning/10"
    },
    {
      id: "#ĐH-2024-003",
      customer: "Lê Hoàng Cường", 
      status: "Chờ thanh toán",
      amount: "₫3,200,000",
      date: "14/03/2024",
      statusColor: "text-destructive",
      statusBg: "bg-destructive/10"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tổng quan hệ thống</h1>
          <p className="text-muted-foreground mt-2">
            Theo dõi hiệu suất bán hàng và quản lý đơn hàng
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <TrendingUp className="w-4 h-4 mr-2" />
            Xuất báo cáo
          </Button>
          <Button className="bg-gradient-primary hover:opacity-90">
            Tạo đơn hàng mới
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-soft hover:shadow-medium transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-success mr-1" />
                <span className="text-sm text-success font-medium">{stat.change}</span>
                <span className="text-sm text-muted-foreground ml-1">từ tháng trước</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Đơn hàng gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-card border flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{order.id}</p>
                      <p className="text-sm text-muted-foreground">{order.customer}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${order.statusBg} ${order.statusColor}`}>
                      {order.status}
                    </div>
                    <p className="text-sm font-medium mt-1">{order.amount}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              Xem tất cả đơn hàng
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Thao tác nhanh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start bg-gradient-primary hover:opacity-90">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Tạo đơn hàng mới
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Package className="w-4 h-4 mr-2" />
              Thêm sản phẩm
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Users className="w-4 h-4 mr-2" />
              Thêm khách hàng
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <CheckCircle className="w-4 h-4 mr-2" />
              Xử lý đơn chờ
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;