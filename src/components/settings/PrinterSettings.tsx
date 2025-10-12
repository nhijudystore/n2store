import { useState, useEffect } from "react";
import { Printer, Plus, Trash2, TestTube2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PrinterSetting {
  id: string;
  printer_name: string;
  printer_ip: string;
  printer_port: number;
  is_active: boolean;
  created_at: string;
}

export function PrinterSettings() {
  const [printers, setPrinters] = useState<PrinterSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  
  const [newPrinter, setNewPrinter] = useState({
    name: "",
    ip: "",
    port: "9100",
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    try {
      const { data, error } = await supabase
        .from("printer_settings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPrinters(data || []);
    } catch (error: any) {
      console.error("Error fetching printers:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải danh sách máy in",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPrinter = async () => {
    if (!newPrinter.name.trim() || !newPrinter.ip.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin",
      });
      return;
    }

    const port = parseInt(newPrinter.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Port không hợp lệ (1-65535)",
      });
      return;
    }

    setIsAdding(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Deactivate all existing printers
      await supabase
        .from("printer_settings")
        .update({ is_active: false })
        .eq("user_id", userData.user.id);

      // Insert new printer as active
      const { error } = await supabase.from("printer_settings").insert({
        user_id: userData.user.id,
        printer_name: newPrinter.name.trim(),
        printer_ip: newPrinter.ip.trim(),
        printer_port: port,
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã thêm máy in mới",
      });

      setNewPrinter({ name: "", ip: "", port: "9100" });
      fetchPrinters();
    } catch (error: any) {
      console.error("Error adding printer:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Deactivate all
      await supabase
        .from("printer_settings")
        .update({ is_active: false })
        .eq("user_id", userData.user.id);

      // Activate selected
      const { error } = await supabase
        .from("printer_settings")
        .update({ is_active: true })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã đặt làm máy in mặc định",
      });

      fetchPrinters();
    } catch (error: any) {
      console.error("Error setting active printer:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("printer_settings")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã xóa máy in",
      });

      fetchPrinters();
    } catch (error: any) {
      console.error("Error deleting printer:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message,
      });
    }
  };

  const handleTestPrint = async (printer: PrinterSetting) => {
    setIsTesting(printer.id);
    try {
      const testBillData = {
        sessionIndex: "TEST",
        customerName: "Test Customer",
        productCode: "TEST001",
        productName: "Test Product",
        comment: "Đây là bản in thử nghiệm",
        phone: "0123456789",
        createdTime: new Date().toISOString(),
      };

      const { data, error } = await supabase.functions.invoke("print-bill", {
        body: { billData: testBillData },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "✅ Test thành công",
          description: data.message,
        });
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error: any) {
      console.error("Test print error:", error);
      toast({
        variant: "destructive",
        title: "❌ Test thất bại",
        description: error.message || "Không thể kết nối với máy in",
      });
    } finally {
      setIsTesting(null);
    }
  };

  if (isLoading) {
    return <div>Đang tải...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Cài đặt máy in nhiệt
        </CardTitle>
        <CardDescription>
          Cấu hình máy in nhiệt qua mạng (IP/Port) để in bill tự động
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            <strong>Lưu ý:</strong> Máy in nhiệt phải hỗ trợ giao thức ESC/POS và kết nối qua mạng. 
            Port mặc định thường là 9100. Đảm bảo máy in và server/máy tính của bạn cùng mạng.
          </AlertDescription>
        </Alert>

        {/* Add New Printer Form */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold">Thêm máy in mới</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="printer-name">Tên máy in</Label>
              <Input
                id="printer-name"
                placeholder="VD: Máy in Live"
                value={newPrinter.name}
                onChange={(e) =>
                  setNewPrinter({ ...newPrinter, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="printer-ip">IP Address</Label>
              <Input
                id="printer-ip"
                placeholder="VD: 192.168.1.100"
                value={newPrinter.ip}
                onChange={(e) =>
                  setNewPrinter({ ...newPrinter, ip: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="printer-port">Port</Label>
              <Input
                id="printer-port"
                type="number"
                placeholder="9100"
                value={newPrinter.port}
                onChange={(e) =>
                  setNewPrinter({ ...newPrinter, port: e.target.value })
                }
              />
            </div>
          </div>
          <Button onClick={handleAddPrinter} disabled={isAdding}>
            <Plus className="h-4 w-4 mr-2" />
            {isAdding ? "Đang thêm..." : "Thêm máy in"}
          </Button>
        </div>

        {/* Printers List */}
        <div className="space-y-3">
          <h3 className="font-semibold">Danh sách máy in ({printers.length})</h3>
          {printers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có máy in nào. Thêm máy in ở trên.
            </p>
          ) : (
            printers.map((printer) => (
              <div
                key={printer.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{printer.printer_name}</h4>
                    {printer.is_active && (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Đang dùng
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {printer.printer_ip}:{printer.printer_port}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!printer.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetActive(printer.id)}
                    >
                      Đặt làm mặc định
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestPrint(printer)}
                    disabled={isTesting === printer.id}
                  >
                    <TestTube2 className="h-4 w-4 mr-1" />
                    {isTesting === printer.id ? "Đang test..." : "Test"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(printer.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
