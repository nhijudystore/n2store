import { supabase } from "@/integrations/supabase/client";

export interface BillData {
  sessionIndex: string;
  phone?: string | null;
  customerName: string;
  productCode: string;
  productName: string;
  comment?: string | null;
  createdTime: string;
}

export interface PrinterSettings {
  id: string;
  printer_name: string;
  printer_ip: string;
  printer_port: number;
  is_active: boolean;
}

/**
 * Test connection to Print Bridge
 */
export async function testPrinterConnection(
  printerIp: string,
  printerPort: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if running on HTTPS
    const isHttps = window.location.protocol === 'https:';
    const protocol = isHttps ? 'https' : 'http';
    
    const response = await fetch(`${protocol}://${printerIp}:${printerPort}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    return { success: response.ok };
  } catch (error: any) {
    console.error('Print Bridge connection error:', error);
    
    // Check if it's a mixed content error
    if (window.location.protocol === 'https:') {
      return {
        success: false,
        error: 'mixed_content'
      };
    }
    
    return {
      success: false,
      error: error.message || 'connection_failed'
    };
  }
}

/**
 * Print bill via Print Bridge
 */
export async function printBill(
  billData: BillData,
  printerIp: string,
  printerPort: number
): Promise<void> {
  // Check if running on HTTPS
  const isHttps = window.location.protocol === 'https:';
  
  if (isHttps) {
    throw new Error('MIXED_CONTENT: Không thể kết nối HTTP Print Bridge từ trang HTTPS. Vui lòng cấu hình Print Bridge với HTTPS hoặc truy cập trang web qua HTTP.');
  }
  
  const protocol = isHttps ? 'https' : 'http';
  
  const printContent = {
    type: "receipt",
    content: [
      { 
        type: "text", 
        value: `#${billData.sessionIndex}`, 
        align: "center", 
        size: "large", 
        bold: true 
      },
      { 
        type: "text", 
        value: billData.customerName, 
        align: "center",
        size: "medium"
      },
      ...(billData.phone ? [{ 
        type: "text", 
        value: billData.phone, 
        align: "center" 
      }] : []),
      { type: "line" },
      { 
        type: "text", 
        value: `${billData.productCode} - ${billData.productName}`, 
        align: "left",
        bold: true
      },
      ...(billData.comment ? [{ 
        type: "text", 
        value: billData.comment, 
        align: "left"
      }] : []),
      { type: "line" },
      { 
        type: "text", 
        value: billData.createdTime, 
        align: "center", 
        size: "small" 
      },
      { type: "cut" }
    ]
  };

  const response = await fetch(`${protocol}://${printerIp}:${printerPort}/print`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(printContent),
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  if (!response.ok) {
    throw new Error(`Print Bridge error: ${response.status} ${response.statusText}`);
  }
}

/**
 * Get active printer from database
 */
export async function getActivePrinter(): Promise<PrinterSettings | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from('printer_settings')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching active printer:', error);
    return null;
  }

  return data;
}
