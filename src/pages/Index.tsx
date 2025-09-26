import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  TrendingUp,
  Plus,
  Eye,
  ArrowRight,
  Store,
  Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const quickStats = [
    { 
      title: "Đơn hàng hôm nay", 
      value: "24", 
      change: "+12%", 
      icon: ShoppingCart,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    { 
      title: "Doanh thu hôm nay", 
      value: "₫8,450,000", 
      change: "+8.5%", 
      icon: TrendingUp,
      color: "text-success", 
      bgColor: "bg-success/10"
    },
    { 
      title: "Sản phẩm bán ra", 
      value: "67", 
      change: "+15%", 
      icon: Package,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    { 
      title: "Khách hàng mới", 
      value: "5", 
      change: "+25%", 
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/10"
    }
  ];

  const recentOrders = [
    { id: "ORD024", customer: "Nguyễn Thị Lan", amount: "₫1,250,000", status: "Đã giao", time: "2 phút trước" },
    { id: "ORD023", customer: "Trần Văn Nam", amount: "₫890,000", status: "Đang giao", time: "15 phút trước" },
    { id: "ORD022", customer: "Lê Thị Hoa", amount: "₫450,000", status: "Chờ xử lý", time: "30 phút trước" },
    { id: "ORD021", customer: "Phạm Minh Tuấn", amount: "₫2,100,000", status: "Đã giao", time: "45 phút trước" }
  ];

  const quickActions = [
    { 
      title: "Thêm đơn hàng mới", 
      description: "Tạo đơn hàng cho khách hàng",
      icon: Plus,
      action: () => navigate("/orders"),
      variant: "default" as const
    },
    { 
      title: "Quản lý sản phẩm", 
      description: "Xem và cập nhật kho hàng",
      icon: Package,
      action: () => navigate("/products"),
      variant: "outline" as const
    },
    { 
      title: "Xem báo cáo", 
      description: "Thống kê và phân tích dữ liệu",
      icon: BarChart3,
      action: () => navigate("/reports"),
      variant: "outline" as const
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Đã giao":
        return <Badge className="bg-success/10 text-success">Đã giao</Badge>;
      case "Đang giao":
        return <Badge className="bg-warning/10 text-warning">Đang giao</Badge>;
      case "Chờ xử lý":
        return <Badge className="bg-muted text-muted-foreground">Chờ xử lý</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-primary text-white mb-4">
          <Store className="w-5 h-5" />
          <span className="font-medium">Hệ Thống Bán Hàng Nội Bộ</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-text bg-clip-text text-transparent">
          Chào mừng trở lại!
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Quản lý đơn hàng, theo dõi doanh số và phân tích hiệu suất kinh doanh một cách hiệu quả
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="shadow-soft hover:shadow-glow transition-all duration-300 cursor-pointer hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold mt-2">{stat.value}</p>
                    <p className="text-success text-sm font-medium mt-1">
                      {stat.change} từ hôm qua
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-primary" />
            Thao tác nhanh
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Card 
                  key={index} 
                  className="cursor-pointer hover:shadow-soft transition-all duration-200 hover:scale-105 border-muted"
                >
                  <CardContent className="p-6 text-center space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{action.title}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
                      <Button 
                        variant={action.variant} 
                        onClick={action.action}
                        className="w-full"
                      >
                        Truy cập ngay
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Đơn hàng gần đây
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/orders")}>
              <Eye className="w-4 h-4 mr-2" />
              Xem tất cả
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div 
                  key={order.id} 
                  className="flex items-center justify-between p-4 rounded-lg bg-gradient-card hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <div>
                      <p className="font-medium">{order.id}</p>
                      <p className="text-sm text-muted-foreground">{order.customer}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{order.amount}</p>
                    <p className="text-xs text-muted-foreground">{order.time}</p>
                  </div>
                  <div>
                    {getStatusBadge(order.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Truy cập nhanh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate("/dashboard")}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard tổng quan
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate("/customers")}
            >
              <Users className="w-4 h-4 mr-2" />
              Quản lý khách hàng
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate("/reports")}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Báo cáo nhà cung cấp
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
