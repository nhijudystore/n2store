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
): Promise<boolean> {
  try {
    const response = await fetch(`http://${printerIp}:${printerPort}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    return response.ok;
  } catch (error) {
    console.error('Print Bridge connection error:', error);
    return false;
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

  const response = await fetch(`http://${printerIp}:${printerPort}/print`, {
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
