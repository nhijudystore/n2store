import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Printer, Plus, Trash2, TestTube2, ChevronDown, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { testPrinterConnection } from "@/lib/print-bridge";
import { PrintBridgeGuide } from "./PrintBridgeGuide";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PrinterConfig {
  id: string;
  printer_name: string;
  printer_ip: string;
  printer_port: number;
  is_active: boolean;
}

export function PrinterSettings() {
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  
  const [newPrinterName, setNewPrinterName] = useState("");
  const [newPrinterIp, setNewPrinterIp] = useState("");
  const [newPrinterPort, setNewPrinterPort] = useState("9100");
  const [newIsActive, setNewIsActive] = useState(false);
  
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrinters(data || []);
    } catch (error: any) {
      console.error('Error fetching printers:', error);
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
    if (!newPrinterName.trim() || !newPrinterIp.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin",
      });
      return;
    }

    const port = parseInt(newPrinterPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Port không hợp lệ (1-65535)",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // If setting as active, deactivate others first
      if (newIsActive) {
        await supabase
          .from('printer_settings')
          .update({ is_active: false })
          .eq('user_id', userData.user.id);
      }

      const { error } = await supabase
        .from('printer_settings')
        .insert({
          printer_name: newPrinterName.trim(),
          printer_ip: newPrinterIp.trim(),
          printer_port: port,
          is_active: newIsActive,
          user_id: userData.user.id,
        });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã thêm máy in mới",
      });

      setNewPrinterName("");
      setNewPrinterIp("");
      setNewPrinterPort("9100");
      setNewIsActive(false);
      setIsAddOpen(false);
      fetchPrinters();
    } catch (error: any) {
      console.error('Error adding printer:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể thêm máy in",
      });
    }
  };

  const handleDeletePrinter = async (printerId: string) => {
    try {
      const { error } = await supabase
        .from('printer_settings')
        .delete()
        .eq('id', printerId);

      if (error) throw error;

      toast({
        title: "Đã xóa",
        description: "Máy in đã được xóa",
      });
      fetchPrinters();
    } catch (error: any) {
      console.error('Error deleting printer:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể xóa máy in",
      });
    }
  };

  const handleTestConnection = async (printer: PrinterConfig) => {
    setTestingPrinterId(printer.id);
    try {
      const result = await testPrinterConnection(printer.printer_ip, printer.printer_port);
      
      if (result.success) {
        toast({
          title: "✅ Kết nối thành công",
          description: `Print Bridge tại ${printer.printer_ip}:${printer.printer_port} đang hoạt động`,
        });
      } else if (result.error === 'mixed_content') {
        toast({
          variant: "destructive",
          title: "❌ Lỗi Mixed Content",
          description: "Trang HTTPS không thể kết nối HTTP Print Bridge. Vui lòng cấu hình Print Bridge với HTTPS hoặc truy cập trang web qua HTTP.",
          duration: 10000,
        });
      } else {
        toast({
          variant: "destructive",
          title: "❌ Không kết nối được",
          description: "Vui lòng kiểm tra Print Bridge đang chạy và IP/Port đúng",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message,
      });
    } finally {
      setTestingPrinterId(null);
    }
  };

  const handleSetActive = async (printerId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Deactivate all
      await supabase
        .from('printer_settings')
        .update({ is_active: false })
        .eq('user_id', userData.user.id);

      // Activate selected
      const { error } = await supabase
        .from('printer_settings')
        .update({ is_active: true })
        .eq('id', printerId);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã đặt làm máy in mặc định",
      });
      fetchPrinters();
    } catch (error: any) {
      console.error('Error setting active printer:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể đặt máy in mặc định",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Cấu hình máy in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PrintBridgeGuide />

        {/* Printer List */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Danh sách máy in</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : printers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có máy in nào</p>
          ) : (
            <div className="space-y-2">
              {printers.map((printer) => (
                <div
                  key={printer.id}
                  className={cn(
                    "flex items-center justify-between p-3 border rounded-lg",
                    isMobile && "flex-col gap-3 items-start"
                  )}
                >
                  <div className={cn("flex-1", isMobile && "w-full")}>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{printer.printer_name}</p>
                      {printer.is_active && (
                        <Badge variant="default" className="text-xs">
                          Mặc định
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {printer.printer_ip}:{printer.printer_port}
                    </p>
                  </div>
                  
                  <div className={cn(
                    "flex items-center gap-2",
                    isMobile && "w-full justify-end"
                  )}>
                    {!printer.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActive(printer.id)}
                      >
                        <Check className="h-4 w-4" />
                        {!isMobile && <span className="ml-1">Đặt mặc định</span>}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(printer)}
                      disabled={testingPrinterId === printer.id}
                    >
                      <TestTube2 className="h-4 w-4" />
                      {!isMobile && <span className="ml-1">Test</span>}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeletePrinter(printer.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Printer */}
        <Collapsible open={isAddOpen} onOpenChange={setIsAddOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className={cn("w-full", isMobile && "text-sm")}>
              <Plus className="h-4 w-4 mr-2" />
              Thêm máy in mới
              <ChevronDown className={cn(
                "h-4 w-4 ml-auto transition-transform",
                isAddOpen && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="printer-name">Tên máy in</Label>
              <Input
                id="printer-name"
                placeholder="VD: Máy in bill quầy 1"
                value={newPrinterName}
                onChange={(e) => setNewPrinterName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="printer-ip">IP Address</Label>
                <Input
                  id="printer-ip"
                  placeholder="192.168.1.100"
                  value={newPrinterIp}
                  onChange={(e) => setNewPrinterIp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="printer-port">Port</Label>
                <Input
                  id="printer-port"
                  type="number"
                  placeholder="9100"
                  value={newPrinterPort}
                  onChange={(e) => setNewPrinterPort(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-active"
                checked={newIsActive}
                onCheckedChange={(checked) => setNewIsActive(checked as boolean)}
              />
              <Label htmlFor="is-active" className="cursor-pointer">
                Đặt làm máy in mặc định
              </Label>
            </div>

            <Button onClick={handleAddPrinter} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Thêm máy in
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
