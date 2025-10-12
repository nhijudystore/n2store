import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";

export function PrintBridgeGuide() {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  return (
    <div className="space-y-4 mb-4">
      {isHttps && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>⚠️ Cảnh báo HTTPS/HTTP</AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-sm">
            <p>
              Trang web đang chạy trên <strong>HTTPS</strong> nhưng Print Bridge chạy trên <strong>HTTP</strong>. 
              Trình duyệt sẽ chặn kết nối này (Mixed Content Error).
            </p>
            
            <div className="mt-2 p-2 bg-background rounded-md">
              <p className="font-semibold mb-1">Giải pháp:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                <li>Cấu hình Print Bridge chạy với HTTPS (khuyến nghị)</li>
                <li>Hoặc truy cập trang web qua HTTP (không khuyến nghị)</li>
                <li>Hoặc sử dụng chế độ in thủ công (popup window)</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Hướng dẫn sử dụng Print Bridge</AlertTitle>
        <AlertDescription className="mt-2 space-y-2 text-sm">
          <p>
            <strong>Print Bridge</strong> là ứng dụng trung gian cho phép in trực tiếp từ web lên máy in nhiệt.
          </p>
          
          <div className="space-y-1">
            <p className="font-semibold">Các bước cài đặt:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Tải và cài đặt Print Bridge trên máy tính/điện thoại</li>
              <li>Kết nối máy in nhiệt với Print Bridge (USB/Bluetooth/WiFi)</li>
              <li>Chạy Print Bridge và ghi nhớ địa chỉ IP hiển thị</li>
              <li>Nhập thông tin máy in vào form bên dưới</li>
              <li>Nhấn "Test kết nối" để kiểm tra</li>
            </ol>
          </div>

          <div className="mt-3 p-2 bg-muted rounded-md">
            <p className="text-xs">
              <strong>Lưu ý:</strong> Để in từ mobile, máy in và điện thoại phải cùng mạng WiFi. 
              IP address có dạng: <code className="bg-background px-1 rounded">192.168.1.xxx</code>
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
