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
  isJSPMInstalled,
  getInstalledPrinters,
  printDirectly,
  PrinterConfig,
} from "@/lib/printer-utils";

export function PrinterSettings() {
  const { toast } = useToast();
  const [isJSPMReady, setIsJSPMReady] = useState(false);
  const [installedPrinters, setInstalledPrinters] = useState<string[]>([]);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  
  const [printerName, setPrinterName] = useState("");
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [silentPrintEnabled, setSilentPrintEnabled] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadPrinterConfig();
    checkJSPM();
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
    const installed = await isJSPMInstalled();
    setIsJSPMReady(installed);
    if (installed) {
      loadPrinters();
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
        {/* JSPM Installation Check */}
        {!isJSPMReady && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Cần cài đặt JSPrintManager</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Vui lòng tải và cài đặt JSPrintManager Client để sử dụng in tự động.</p>
              <Button variant="link" className="h-auto p-0" asChild>
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

        {isJSPMReady && (
          <>
            {/* Printer Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Máy in mặc định</label>
              <div className="flex gap-2">
                <Select value={printerName} onValueChange={setPrinterName}>
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
              <Button onClick={handleTestPrint} disabled={!printerName} variant="outline">
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
