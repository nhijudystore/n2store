import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRandomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getTPOSHeaders(bearerToken: string) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type": "application/json;charset=UTF-8",
    authorization: `Bearer ${bearerToken}`,
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

async function fetchTPOSProductsBatch(
  bearerToken: string,
  top: number,
  skip: number
): Promise<any[]> {
  const url = `https://tomato.tpos.vn/odata/ProductTemplate/ODataService.GetViewV2?Active=true&priceId=0&$top=${top}&$orderby=DateCreated+desc&$filter=Active+eq+true&$count=true&$skip=${skip}`;
  
  console.log(`Fetching TPOS products: top=${top}, skip=${skip}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getTPOSHeaders(bearerToken),
  });

  if (!response.ok) {
    console.error(`TPOS API error: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error('Response body:', text);
    throw new Error(`TPOS API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value || [];
}

async function fetchAllTPOSProducts(bearerToken: string): Promise<any[]> {
  console.log('Starting to fetch all 2160 TPOS products...');
  
  // Fetch all 3 batches in parallel
  const [batch1, batch2, batch3] = await Promise.all([
    fetchTPOSProductsBatch(bearerToken, 1000, 0),    // Products 1-1000
    fetchTPOSProductsBatch(bearerToken, 1000, 1000), // Products 1001-2000
    fetchTPOSProductsBatch(bearerToken, 160, 2000),  // Products 2001-2160
  ]);

  const allProducts = [...batch1, ...batch2, ...batch3];
  console.log(`Successfully fetched ${allProducts.length} products from TPOS`);
  
  return allProducts;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bearerToken = Deno.env.get('TPOS_BEARER_TOKEN');
    if (!bearerToken) {
      throw new Error('TPOS_BEARER_TOKEN not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting TPOS image sync...');

    // 1. Get ALL products from database (to match by product_code)
    const { data: dbProducts, error: dbError } = await supabase
      .from('products')
      .select('id, product_code, product_name, tpos_product_id, tpos_image_url');

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log(`Found ${dbProducts?.length || 0} products to sync`);

    // 2. Fetch all products from TPOS
    const tposProducts = await fetchAllTPOSProducts(bearerToken);

    // 3. Create a map: DefaultCode -> {Id, ImageUrl}
    const tposProductMap = new Map(
      tposProducts.map((p: any) => [
        p.DefaultCode, 
        { id: p.Id, imageUrl: p.ImageUrl || null }
      ])
    );

    console.log(`Created TPOS product map with ${tposProductMap.size} entries`);

    // 4. Update products by matching product_code with DefaultCode
    let updatedCount = 0;
    let notFoundCount = 0;
    let skippedCount = 0;
    const updateErrors: any[] = [];

    for (const dbProduct of dbProducts || []) {
      const tposProduct = tposProductMap.get(dbProduct.product_code);
      
      if (!tposProduct) {
        notFoundCount++;
        console.log(`Product ${dbProduct.product_code} not found in TPOS`);
        continue;
      }

      // Skip if already up-to-date
      if (dbProduct.tpos_product_id === tposProduct.id && 
          dbProduct.tpos_image_url === tposProduct.imageUrl) {
        skippedCount++;
        continue;
      }

      // Update the product with both tpos_product_id and tpos_image_url
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          tpos_product_id: tposProduct.id,
          tpos_image_url: tposProduct.imageUrl 
        })
        .eq('id', dbProduct.id);

      if (updateError) {
        console.error(`Failed to update product ${dbProduct.product_code}:`, updateError);
        updateErrors.push({
          product_code: dbProduct.product_code,
          error: updateError.message
        });
      } else {
        updatedCount++;
        console.log(`Updated ${dbProduct.product_code}: TPOS ID=${tposProduct.id}, Image=${tposProduct.imageUrl ? 'Yes' : 'No'}`);
      }
    }

    const summary = {
      total_products: dbProducts?.length || 0,
      updated: updatedCount,
      skipped: skippedCount,
      not_found_in_tpos: notFoundCount,
      errors: updateErrors.length,
    };

    console.log('Sync completed:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        updateErrors: updateErrors.length > 0 ? updateErrors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-tpos-images:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
