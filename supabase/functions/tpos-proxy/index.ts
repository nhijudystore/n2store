// Edge function for TPOS API proxy

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TPOS_BEARER_TOKEN = Deno.env.get('TPOS_BEARER_TOKEN');
const TPOS_API_BASE = "https://tomato.tpos.vn/odata/ProductTemplate";

function generateRandomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getTPOSHeaders() {
  return {
    accept: "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type": "application/json;charset=UTF-8",
    authorization: `Bearer ${TPOS_BEARER_TOKEN}`,
    origin: "https://tomato.tpos.vn",
    referer: "https://tomato.tpos.vn/",
    "sec-ch-ua": '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    tposappversion: "5.9.10.1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "x-request-id": generateRandomId(),
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { action, data } = await req.json();
    console.log('TPOS Proxy action:', action);

    let response;

    switch (action) {
      case 'uploadExcel': {
        const formData = new FormData();
        const blob = new Blob([Uint8Array.from(atob(data.excelBase64), c => c.charCodeAt(0))], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        formData.append('file', blob, 'products.xlsx');

        response = await fetch(`${TPOS_API_BASE}/ImportExcel`, {
          method: 'POST',
          headers: {
            ...getTPOSHeaders(),
            'content-type': 'multipart/form-data',
          },
          body: formData,
        });
        break;
      }

      case 'getLatestProducts': {
        const url = `${TPOS_API_BASE}?$orderby=WriteDate desc&$top=${data.count}&$select=Id,Name,DefaultCode`;
        response = await fetch(url, {
          method: 'GET',
          headers: getTPOSHeaders(),
        });
        break;
      }

      case 'getProductDetail': {
        const expandParams = "UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues),AttributeLines,UOMLines($expand=UOM),ComboProducts,ProductSupplierInfos";
        const url = `${TPOS_API_BASE}(${data.productId})?$expand=${expandParams}`;
        response = await fetch(url, {
          method: 'GET',
          headers: getTPOSHeaders(),
        });
        break;
      }

      case 'updateProduct': {
        const url = `${TPOS_API_BASE}(${data.productId})`;
        response = await fetch(url, {
          method: 'PATCH',
          headers: getTPOSHeaders(),
          body: JSON.stringify(data.updateData),
        });
        break;
      }

      case 'checkProductsExist': {
        const results = new Map();
        for (const productId of data.productIds) {
          try {
            const url = `${TPOS_API_BASE}(${productId})?$select=Id`;
            const checkResponse = await fetch(url, {
              method: 'GET',
              headers: getTPOSHeaders(),
            });
            results.set(productId, checkResponse.ok);
          } catch {
            results.set(productId, false);
          }
        }
        return new Response(
          JSON.stringify({ results: Object.fromEntries(results) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getAttributes': {
        // Return local attributes definition
        const attributes = {
          size: { Id: 1, Name: "Size" },
          color: { Id: 2, Name: "Màu sắc" }
        };
        return new Response(
          JSON.stringify({ attributes }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const responseData = await response.json();
    console.log('TPOS API response status:', response.status);

    return new Response(
      JSON.stringify(responseData),
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in TPOS proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
