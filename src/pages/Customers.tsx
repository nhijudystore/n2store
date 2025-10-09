import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit, 
  Trash2,
  Phone,
  Mail,
  MapPin
} from "lucide-react";
import { formatVND } from "@/lib/currency-utils";

type Customer = {
  id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  customer_status: string;
  info_status: string;
  total_orders: number;
  total_spent: number;
  facebook_id: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerFormData = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'total_orders' | 'total_spent'>;

const statusColors: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  bomb: 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  wholesale: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  close: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
  vip: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
};

const statusLabels: Record<string, string> = {
  normal: 'Bình thường',
  bomb: 'Bom hàng',
  warning: 'Cảnh báo',
  wholesale: 'Khách sỉ',
  danger: 'Nguy hiểm',
  close: 'Thân thiết',
  vip: 'VIP',
};

const infoStatusLabels: Record<string, string> = {
  complete: 'Đầy đủ',
  incomplete: 'Chưa đủ',
};

const infoStatusColors: Record<string, string> = {
  complete: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  incomplete: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
};

export default function Customers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    customer_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    customer_status: "normal",
    info_status: "incomplete",
    facebook_id: "",
  });

  // Fetch customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
  });

  // Create customer mutation
  const createMutation = useMutation({
    mutationFn: async (newCustomer: CustomerFormData) => {
      const { data, error } = await supabase
        .from("customers")
        .insert([newCustomer])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã thêm khách hàng mới");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  // Update customer mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CustomerFormData> }) => {
      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã cập nhật khách hàng");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  // Delete customer mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã xóa khách hàng");
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_name.trim()) {
      toast.error("Vui lòng nhập tên khách hàng");
      return;
    }

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customer_name: customer.customer_name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
      customer_status: customer.customer_status,
      info_status: customer.info_status || "incomplete",
      facebook_id: customer.facebook_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc muốn xóa khách hàng này?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
    setFormData({
      customer_name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      customer_status: "normal",
      info_status: "incomplete",
      facebook_id: "",
    });
  };

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = 
      customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || customer.customer_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: customers.length,
    normal: customers.filter(c => c.customer_status === "normal").length,
    warning: customers.filter(c => c.customer_status === "warning").length,
    danger: customers.filter(c => c.customer_status === "danger").length,
    vip: customers.filter(c => c.customer_status === "vip").length,
    bomb: customers.filter(c => c.customer_status === "bomb").length,
    wholesale: customers.filter(c => c.customer_status === "wholesale").length,
    close: customers.filter(c => c.customer_status === "close").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Kho Khách Hàng
          </h1>
          <p className="text-muted-foreground mt-1">
            Quản lý thông tin khách hàng
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleCloseDialog()}>
              <UserPlus className="w-4 h-4 mr-2" />
              Thêm Khách Hàng
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Chỉnh Sửa Khách Hàng" : "Thêm Khách Hàng Mới"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Tên khách hàng *</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    placeholder="Nhập tên khách hàng"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Nhập số điện thoại"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Nhập email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_status">Trạng thái</Label>
                  <Select
                    value={formData.customer_status}
                    onValueChange={(value) => setFormData({ ...formData, customer_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Bình thường</SelectItem>
                      <SelectItem value="bomb">Bom hàng</SelectItem>
                      <SelectItem value="warning">Cảnh báo</SelectItem>
                      <SelectItem value="wholesale">Khách sỉ</SelectItem>
                      <SelectItem value="danger">Nguy hiểm</SelectItem>
                      <SelectItem value="close">Thân thiết</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Nhập địa chỉ"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facebook_id">Facebook ID</Label>
                <Input
                  id="facebook_id"
                  value={formData.facebook_id}
                  onChange={(e) => setFormData({ ...formData, facebook_id: e.target.value })}
                  placeholder="Nhập Facebook ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Nhập ghi chú"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Hủy
                </Button>
                <Button type="submit">
                  {editingCustomer ? "Cập Nhật" : "Thêm"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tổng KH</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Bình thường</p>
              <p className="text-2xl font-bold">{stats.normal}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cảnh báo</p>
              <p className="text-2xl font-bold">{stats.warning}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Nguy hiểm</p>
              <p className="text-2xl font-bold">{stats.danger}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">VIP</p>
              <p className="text-2xl font-bold">{stats.vip}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Bom hàng</p>
              <p className="text-2xl font-bold">{stats.bomb}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Khách sỉ</p>
              <p className="text-2xl font-bold">{stats.wholesale}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Thân thiết</p>
              <p className="text-2xl font-bold">{stats.close}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Tìm kiếm theo tên, SĐT, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Lọc theo trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="normal">Bình thường</SelectItem>
              <SelectItem value="bomb">Bom hàng</SelectItem>
              <SelectItem value="warning">Cảnh báo</SelectItem>
              <SelectItem value="wholesale">Khách sỉ</SelectItem>
              <SelectItem value="danger">Nguy hiểm</SelectItem>
              <SelectItem value="close">Thân thiết</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên khách hàng</TableHead>
              <TableHead>Liên hệ</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead>Trạng thái KH</TableHead>
              <TableHead>Trạng thái TT</TableHead>
              <TableHead className="text-right">Đơn hàng</TableHead>
              <TableHead className="text-right">Tổng chi</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Không có khách hàng nào
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.customer_name}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      {customer.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.address && (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3 h-3" />
                        <span className="line-clamp-2">{customer.address}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className={cn("inline-flex px-2 py-1 rounded-full text-xs font-medium", statusColors[customer.customer_status])}>
                      {statusLabels[customer.customer_status]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn("inline-flex px-2 py-1 rounded-full text-xs font-medium", infoStatusColors[customer.info_status || 'incomplete'])}>
                      {infoStatusLabels[customer.info_status || 'incomplete']}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{customer.total_orders}</TableCell>
                  <TableCell className="text-right">
                    {formatVND(customer.total_spent)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(customer.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}