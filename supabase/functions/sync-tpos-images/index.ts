import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TPOSProduct {
  Id: number;
  Code: string;
  Name: string;
  ImgUrl?: string;
  Image?: string;
  ImageUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const TPOS_BEARER_TOKEN = Deno.env.get('TPOS_BEARER_TOKEN')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!TPOS_BEARER_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    console.log('Starting TPOS image sync...')

    // Fetch products from TPOS in batches
    let allTPOSProducts: TPOSProduct[] = []
    const batchSize = 1000
    let skip = 0
    let hasMore = true
    let batchNumber = 1

    while (hasMore) {
      const params = new URLSearchParams({
        'Active': 'true',
        'priceId': '0',
        '$top': batchSize.toString(),
        '$skip': skip.toString(),
        '$orderby': 'DateCreated desc',
        '$filter': 'Active eq true',
        '$count': 'true'
      })

      console.log(`Fetching TPOS batch ${batchNumber} (skip: ${skip})...`)

      const response = await fetch(
        `https://tomato.tpos.vn/odata/ProductTemplate/ODataService.GetViewV2?${params.toString()}`,
        {
          headers: {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'authorization': `Bearer ${TPOS_BEARER_TOKEN}`,
            'content-type': 'application/json;charset=UTF-8',
            'origin': 'https://tomato.tpos.vn',
            'referer': 'https://tomato.tpos.vn/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'tposappversion': '5.9.10.1',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch TPOS products: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const products = data.value || []
      
      console.log(`TPOS Batch ${batchNumber}: Got ${products.length} products`)
      
      if (products.length === 0) {
        hasMore = false
      } else {
        allTPOSProducts = [...allTPOSProducts, ...products]
        skip += batchSize
        batchNumber++
        
        if (batchNumber > 10) break // Safety limit
      }
    }

    console.log(`Total TPOS products fetched: ${allTPOSProducts.length}`)

    // Create a map of Code -> ImgUrl for TPOS products
    const tposImageMap = new Map<string, { imgUrl: string, tposId: number }>()
    allTPOSProducts.forEach(product => {
      const imgUrl = product.ImgUrl || product.ImageUrl || product.Image || ''
      if (imgUrl && imgUrl !== '' && product.Code) {
        tposImageMap.set(product.Code.toUpperCase(), {
          imgUrl,
          tposId: product.Id
        })
      }
    })

    console.log(`TPOS products with valid images: ${tposImageMap.size}`)

    // Fetch all products from database
    const { data: dbProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, product_code, tpos_image_url, tpos_product_id')

    if (fetchError) {
      throw new Error(`Failed to fetch database products: ${fetchError.message}`)
    }

    console.log(`Database products: ${dbProducts?.length || 0}`)

    // Match and update products
    let matchedCount = 0
    let updatedCount = 0
    let skippedCount = 0

    for (const dbProduct of dbProducts || []) {
      const productCode = dbProduct.product_code.toUpperCase()
      const tposData = tposImageMap.get(productCode)

      if (tposData) {
        matchedCount++
        
        // Only update if image URL or TPOS ID is different or missing
        if (dbProduct.tpos_image_url !== tposData.imgUrl || dbProduct.tpos_product_id !== tposData.tposId) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              tpos_image_url: tposData.imgUrl,
              tpos_product_id: tposData.tposId,
            })
            .eq('id', dbProduct.id)

          if (updateError) {
            console.error(`Failed to update product ${productCode}:`, updateError)
          } else {
            updatedCount++
            console.log(`Updated: ${productCode} -> ${tposData.imgUrl.substring(0, 50)}...`)
          }
        } else {
          skippedCount++
        }
      }
    }

    const result = {
      success: true,
      tpos_products_total: allTPOSProducts.length,
      tpos_products_with_images: tposImageMap.size,
      database_products_total: dbProducts?.length || 0,
      matched_by_code: matchedCount,
      updated: updatedCount,
      skipped_unchanged: skippedCount,
      not_found_in_tpos: (dbProducts?.length || 0) - matchedCount,
    }

    console.log('Sync completed:', result)

    return new Response(
      JSON.stringify(result, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: 'Failed to sync TPOS images' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
