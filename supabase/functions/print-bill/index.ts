import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BillData {
  sessionIndex: string;
  customerName: string;
  productCode: string;
  productName: string;
  comment?: string;
  phone?: string;
  createdTime: string;
}

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';

function generateESCPOS(billData: BillData): Uint8Array {
  const encoder = new TextEncoder();
  let commands = '';
  
  // Initialize printer
  commands += ESC + '@';
  
  // Set code page to UTF-8
  commands += ESC + 't' + '\x10';
  
  // Center alignment
  commands += ESC + 'a' + '\x01';
  
  // Double size for order number
  commands += GS + '!' + '\x11';
  commands += `#${billData.sessionIndex} - ${billData.phone || 'Chua co SDT'}\n`;
  
  // Normal size
  commands += GS + '!' + '\x00';
  
  // Bold on
  commands += ESC + 'E' + '\x01';
  commands += `${billData.customerName}\n`;
  commands += ESC + 'E' + '\x00';
  
  // Product info
  commands += `${billData.productCode} - ${billData.productName.replace(/^\d+\s+/, '')}\n`;
  
  // Comment if exists
  if (billData.comment) {
    commands += ESC + 'a' + '\x01'; // Center
    commands += `"${billData.comment}"\n`;
  }
  
  // Date/time
  commands += '\n';
  const dateStr = new Date(billData.createdTime).toLocaleString('vi-VN', {
    timeZone: 'Asia/Bangkok',
    hour12: false,
  });
  commands += `${dateStr}\n`;
  
  // Feed paper
  commands += ESC + 'd' + '\x03';
  
  // Cut paper (full cut)
  commands += GS + 'V' + '\x00';
  
  return encoder.encode(commands);
}

async function sendToPrinter(ip: string, port: number, data: Uint8Array): Promise<void> {
  console.log(`Connecting to printer at ${ip}:${port}`);
  
  try {
    const conn = await Deno.connect({
      hostname: ip,
      port: port,
      transport: 'tcp',
    });
    
    console.log('Connected to printer, sending data...');
    await conn.write(data);
    
    console.log('Data sent successfully');
    conn.close();
  } catch (error) {
    console.error('Failed to connect to printer:', error);
    throw new Error(`Không thể kết nối với máy in tại ${ip}:${port}. Kiểm tra IP và Port.`);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get request body
    const { billData } = await req.json() as { billData: BillData };
    
    if (!billData) {
      throw new Error('Missing bill data');
    }

    console.log('Bill data received:', billData);

    // Get active printer settings for this user
    const { data: printerSettings, error: settingsError } = await supabaseClient
      .from('printer_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Database error: ${settingsError.message}`);
    }

    if (!printerSettings) {
      throw new Error('Chưa cấu hình máy in. Vui lòng vào Cài đặt để thêm máy in.');
    }

    console.log('Using printer:', printerSettings.printer_name);

    // Generate ESC/POS commands
    const escposData = generateESCPOS(billData);
    
    console.log(`ESC/POS data size: ${escposData.length} bytes`);

    // Send to printer
    await sendToPrinter(
      printerSettings.printer_ip,
      printerSettings.printer_port,
      escposData
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã in thành công qua ${printerSettings.printer_name}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in print-bill function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
