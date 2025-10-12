import { useState, useEffect } from "react";
import { Printer, RefreshCw, TestTube2, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getPrinterConfig,
  savePrinterConfig,
  checkJSPMStatus,
  getInstalledPrinters,
  printDirectly,
  PrinterConfig,
} from "@/lib/printer-utils";

export function PrinterSettings() {
  const { toast } = useToast();
  const [isJSPMReady, setIsJSPMReady] = useState(false);
  const [installedPrinters, setInstalledPrinters] = useState<string[]>([]);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [isCheckingJSPM, setIsCheckingJSPM] = useState(true);
  const [jspmStatus, setJspmStatus] = useState<'checking' | 'connected' | 'disconnected' | 'not-installed'>('checking');
  
  const [printerName, setPrinterName] = useState("");
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [silentPrintEnabled, setSilentPrintEnabled] = useState(false);

  // Load config on mount and check JSPM periodically
  useEffect(() => {
    loadPrinterConfig();
    checkJSPM();
    
    // Auto-refresh every 30s
    const interval = setInterval(() => {
      checkJSPM();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadPrinterConfig = () => {
    const config = getPrinterConfig();
    if (config) {
      setPrinterName(config.printerName);
      setPaperSize(config.paperSize);
      setSilentPrintEnabled(config.silentPrintEnabled);
    }
  };

  const checkJSPM = async () => {
    setIsCheckingJSPM(true);
    setJspmStatus('checking');
    
    try {
      const statusResult = await checkJSPMStatus();
      
      setIsJSPMReady(statusResult.isConnected);
      setJspmStatus(statusResult.status);
      
      if (statusResult.isConnected) {
        await loadPrinters();
      }
    } catch (error) {
      console.error('JSPM check error:', error);
      setIsJSPMReady(false);
      setJspmStatus('disconnected');
    } finally {
      setIsCheckingJSPM(false);
    }
  };

  const loadPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const printers = await getInstalledPrinters();
      setInstalledPrinters(printers);
      if (printers.length > 0 && !printerName) {
        setPrinterName(printers[0]);
      }
    } catch (error) {
      console.error('Error loading printers:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải danh sách máy in",
      });
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const handleSavePrinterConfig = () => {
    const config: PrinterConfig = {
      printerName,
      paperSize,
      silentPrintEnabled,
    };
    savePrinterConfig(config);
    toast({
      title: "✅ Đã lưu",
      description: "Cấu hình máy in đã được lưu",
    });
  };

  const handleTestPrint = async () => {
    if (!printerName) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng chọn máy in",
      });
      return;
    }

    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Print</title>
          <style>
            @page { margin: 0; size: ${paperSize} auto; }
            body { 
              margin: 0; 
              padding: 10px; 
              font-family: monospace; 
              text-align: center;
              font-size: 12px;
            }
            h3 { margin: 10px 0; font-size: 16px; }
            p { margin: 5px 0; }
          </style>
        </head>
        <body>
          <h3>✅ Test In Thành Công</h3>
          <p>━━━━━━━━━━━━━━━━━━━━</p>
          <p><strong>Máy in:</strong> ${printerName}</p>
          <p><strong>Kích thước:</strong> ${paperSize}</p>
          <p>━━━━━━━━━━━━━━━━━━━━</p>
          <p>${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' })}</p>
        </body>
      </html>
    `;

    try {
      const success = await printDirectly(testHtml, printerName);
      if (success) {
        toast({
          title: "✅ Test thành công",
          description: "Vui lòng kiểm tra máy in",
        });
      } else {
        throw new Error("Print failed");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Test thất bại",
        description: "Vui lòng kiểm tra kết nối máy in",
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
        <CardDescription>
          Cấu hình in tự động không cần xác nhận
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-3 w-3 rounded-full",
              jspmStatus === 'connected' && "bg-green-500 animate-pulse",
              jspmStatus === 'disconnected' && "bg-yellow-500",
              jspmStatus === 'not-installed' && "bg-red-500",
              jspmStatus === 'checking' && "bg-gray-400 animate-pulse"
            )} />
            <div>
              <p className="font-medium">
                {jspmStatus === 'connected' && "✅ Đã kết nối"}
                {jspmStatus === 'disconnected' && "⚠️ Chưa kết nối"}
                {jspmStatus === 'not-installed' && "❌ Chưa cài đặt"}
                {jspmStatus === 'checking' && "🔄 Đang kiểm tra..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {jspmStatus === 'connected' && `Đã kết nối với ${installedPrinters.length} máy in`}
                {jspmStatus === 'disconnected' && "JSPrintManager service chưa chạy"}
                {jspmStatus === 'not-installed' && "Cần cài đặt JSPrintManager Client"}
                {jspmStatus === 'checking' && "Đang kiểm tra trạng thái kết nối..."}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={checkJSPM} 
            disabled={isCheckingJSPM}
            variant="ghost"
            size="sm"
          >
            <RefreshCw className={cn("h-4 w-4", isCheckingJSPM && "animate-spin")} />
          </Button>
        </div>

        {/* Download link - only show if not installed */}
        {jspmStatus === 'not-installed' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Hướng dẫn cài đặt</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal ml-4 space-y-1 text-sm">
                <li>Tải JSPrintManager Client từ link bên dưới</li>
                <li>Cài đặt và chạy service</li>
                <li>Click "Kiểm tra kết nối" để xác nhận</li>
              </ol>
              <Button variant="link" className="h-auto p-0 mt-2" asChild>
                <a 
                  href="https://www.neodynamic.com/downloads/jspm/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Tải về JSPrintManager →
                </a>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Service not running - show troubleshooting */}
        {jspmStatus === 'disconnected' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Service chưa chạy</AlertTitle>
            <AlertDescription>
              <p className="text-sm">JSPrintManager đã cài đặt nhưng service chưa chạy.</p>
              <p className="text-sm mt-1">Vui lòng:</p>
              <ul className="list-disc ml-4 text-sm">
                <li>Mở JSPrintManager Client</li>
                <li>Đảm bảo service đang chạy (icon trong system tray)</li>
                <li>Click nút refresh để kiểm tra lại</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Printer Settings - only show when connected */}
        {jspmStatus === 'connected' && (
          <>
            {/* Printer Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Máy in mặc định</label>
              <div className="flex gap-2">
                <Select value={printerName} onValueChange={setPrinterName} disabled={!isJSPMReady}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Chọn máy in" />
                  </SelectTrigger>
                  <SelectContent>
                    {installedPrinters.map((printer) => (
                      <SelectItem key={printer} value={printer}>
                        {printer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  size="icon" 
                  variant="outline"
                  onClick={loadPrinters} 
                  disabled={isLoadingPrinters}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoadingPrinters && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Paper Size */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Kích thước giấy</label>
              <Select value={paperSize} onValueChange={(v) => setPaperSize(v as '80mm' | '58mm')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm (Mặc định)</SelectItem>
                  <SelectItem value="58mm">58mm (Mini)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Enable Silent Print */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="silent-print"
                checked={silentPrintEnabled}
                onCheckedChange={(checked) => setSilentPrintEnabled(checked as boolean)}
              />
              <label htmlFor="silent-print" className="text-sm font-medium cursor-pointer">
                Bật in tự động (không cần xác nhận)
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={handleTestPrint} disabled={!printerName || !isJSPMReady} variant="outline">
                <TestTube2 className="h-4 w-4 mr-2" />
                Test in thử
              </Button>

              <Button onClick={handleSavePrinterConfig}>
                <Save className="h-4 w-4 mr-2" />
                Lưu cấu hình
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
