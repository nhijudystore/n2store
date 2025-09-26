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
  Star,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Products = () => {
  const products = [
    {
      id: "SP001",
      name: "iPhone 15 Pro Max 256GB",
      category: "Điện thoại",
      price: "₫29,990,000",
      stock: 15,
      sold: 143,
      status: "active",
      statusText: "Đang bán",
      image: "📱",
      rating: 4.8,
      reviews: 89
    },
    {
      id: "SP002", 
      name: "MacBook Air M3 13 inch",
      category: "Laptop",
      price: "₫24,990,000",
      stock: 8,
      sold: 67,
      status: "active",
      statusText: "Đang bán", 
      image: "💻",
      rating: 4.9,
      reviews: 124
    },
    {
      id: "SP003",
      name: "AirPods Pro 2nd Gen",
      category: "Phụ kiện",
      price: "₫6,490,000", 
      stock: 32,
      sold: 256,
      status: "active",
      statusText: "Đang bán",
      image: "🎧",
      rating: 4.7,
      reviews: 203
    },
    {
      id: "SP004",
      name: "iPad Pro 12.9 inch M2",
      category: "Máy tính bảng",
      price: "₫31,990,000",
      stock: 5,
      sold: 34,
      status: "low_stock", 
      statusText: "Sắp hết hàng",
      image: "📟",
      rating: 4.8,
      reviews: 67
    },
    {
      id: "SP005",
      name: "Apple Watch Series 9",
      category: "Đồng hồ thông minh",
      price: "₫10,990,000",
      stock: 0,
      sold: 89,
      status: "out_of_stock",
      statusText: "Hết hàng",
      image: "⌚",
      rating: 4.6,
      reviews: 145
    },
    {
      id: "SP006",
      name: "Magic Mouse 3",
      category: "Phụ kiện", 
      price: "₫2,290,000",
      stock: 25,
      sold: 178,
      status: "active",
      statusText: "Đang bán",
      image: "🖱️",
      rating: 4.4,
      reviews: 92
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-success bg-success/10';
      case 'low_stock':
        return 'text-warning bg-warning/10';
      case 'out_of_stock':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStockIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Package className="w-4 h-4" />;
      case 'low_stock':
        return <AlertTriangle className="w-4 h-4" />;
      case 'out_of_stock':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý sản phẩm</h1>
          <p className="text-muted-foreground mt-2">
            Quản lý kho hàng và thông tin sản phẩm
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Thêm sản phẩm mới
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Tổng sản phẩm</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
              <Package className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Đang bán</p>
                <p className="text-2xl font-bold text-success">
                  {products.filter(p => p.status === 'active').length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Sắp hết hàng</p>
                <p className="text-2xl font-bold text-warning">
                  {products.filter(p => p.status === 'low_stock').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Hết hàng</p>
                <p className="text-2xl font-bold text-destructive">
                  {products.filter(p => p.status === 'out_of_stock').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-soft">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Tìm kiếm sản phẩm theo tên, mã sản phẩm..."
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Lọc theo danh mục
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product, index) => (
          <Card key={index} className="shadow-soft hover:shadow-medium transition-all duration-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-card border flex items-center justify-center text-2xl">
                    {product.image}
                  </div>
                  <div>
                    <CardTitle className="text-base line-clamp-2">{product.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                  </div>
                </div>
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                  {getStockIcon(product.status)}
                  <span className="ml-1">{product.statusText}</span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{product.price}</p>
                  <p className="text-sm text-muted-foreground">Mã: {product.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-warning text-warning" />
                  <span className="font-medium">{product.rating}</span>
                  <span className="text-muted-foreground">({product.reviews})</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tồn kho</p>
                  <p className="font-semibold">{product.stock} sản phẩm</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Đã bán</p>
                  <p className="font-semibold">{product.sold} sản phẩm</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="w-4 h-4 mr-2" />
                  Xem
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Sửa
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Sao chép sản phẩm</DropdownMenuItem>
                    <DropdownMenuItem>Xuất báo cáo</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Xóa sản phẩm</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center">
        <Button variant="outline">Tải thêm sản phẩm</Button>
      </div>
    </div>
  );
};

export default Products;