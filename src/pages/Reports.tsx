import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  DollarSign,
  ShoppingCart,
  Users,
  Package
} from "lucide-react";

const Reports = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Báo cáo & Thống kê</h1>
          <p className="text-muted-foreground mt-2">
            Phân tích doanh số và hiệu suất kinh doanh
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Chọn thời gian
          </Button>
          <Button className="bg-gradient-primary hover:opacity-90">
            <Download className="w-4 h-4 mr-2" />
            Xuất báo cáo
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Doanh thu tháng</p>
                <p className="text-2xl font-bold">₫125,640,000</p>
                <p className="text-success text-sm font-medium">+12.5% từ tháng trước</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10">
                <DollarSign className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Đơn hàng tháng</p>
                <p className="text-2xl font-bold">1,247</p>
                <p className="text-success text-sm font-medium">+8.2% từ tháng trước</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <ShoppingCart className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Khách hàng mới</p>
                <p className="text-2xl font-bold">89</p>
                <p className="text-success text-sm font-medium">+15.3% từ tháng trước</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/10">
                <Users className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Sản phẩm bán chạy</p>
                <p className="text-2xl font-bold">1,892</p>
                <p className="text-success text-sm font-medium">+23.1% từ tháng trước</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10">
                <Package className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Doanh thu theo tháng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gradient-card rounded-lg border">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Biểu đồ doanh thu</p>
                <p className="text-sm text-muted-foreground">Sẽ hiển thị khi có dữ liệu</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Xu hướng đơn hàng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gradient-card rounded-lg border">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Biểu đồ xu hướng</p>
                <p className="text-sm text-muted-foreground">Sẽ hiển thị khi có dữ liệu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products & Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Sản phẩm bán chạy nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "iPhone 15 Pro Max", sold: 143, revenue: "₫31,890,000", growth: "+15%" },
                { name: "MacBook Air M3", sold: 67, revenue: "₫24,990,000", growth: "+12%" },
                { name: "AirPods Pro 2", sold: 256, revenue: "₫18,670,000", growth: "+25%" },
                { name: "iPad Pro M2", sold: 34, revenue: "₫15,440,000", growth: "+8%" }
              ].map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sold} sản phẩm</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{product.revenue}</p>
                    <p className="text-sm text-success">{product.growth}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Khách hàng VIP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Phạm Thu Hà", orders: 22, spent: "₫67,320,000", avatar: "👩‍🎨" },
                { name: "Nguyễn Văn An", orders: 15, spent: "₫45,890,000", avatar: "🧑‍💼" },
                { name: "Đỗ Minh Hạnh", orders: 12, spent: "₫28,750,000", avatar: "👩‍🏫" },
                { name: "Trần Thị Bình", orders: 8, spent: "₫12,450,000", avatar: "👩‍💼" }
              ].map((customer, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-card border flex items-center justify-center text-lg">
                      {customer.avatar}
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">{customer.orders} đơn hàng</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{customer.spent}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;