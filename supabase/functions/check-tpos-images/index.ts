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
    if (!TPOS_BEARER_TOKEN) {
      throw new Error('TPOS_BEARER_TOKEN not configured')
    }

    console.log('Fetching all TPOS products with pagination...')

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
            'Authorization': `Bearer ${TPOS_BEARER_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        console.error(`Failed to fetch batch ${batchNumber}:`, response.status)
        const errorText = await response.text()
        throw new Error(`Failed to fetch TPOS products: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const products = data.value || []
      const totalCount = data['@odata.count'] || 0
      
      console.log(`TPOS Batch ${batchNumber}: Got ${products.length} products (Total: ${totalCount})`)
      
      if (products.length === 0) {
        hasMore = false
      } else {
        allTPOSProducts = [...allTPOSProducts, ...products]
        skip += batchSize
        batchNumber++
        
        // Stop if we've fetched all available products
        if (allTPOSProducts.length >= totalCount) {
          hasMore = false
        }
      }

      // Safety limit
      if (batchNumber > 10) {
        console.warn('Reached batch limit of 10')
        break
      }
    }

    console.log(`Total TPOS products fetched: ${allTPOSProducts.length}`)

    // Analyze image URLs
    const stats = {
      total_products: allTPOSProducts.length,
      with_img_url: 0,
      with_empty_img_url: 0,
      with_image: 0,
      with_image_url: 0,
      without_any_image: 0,
      products_with_images: [] as { id: number; code: string; name: string; img_url: string | null }[],
    }

    allTPOSProducts.forEach(product => {
      const imgUrl = product.ImgUrl || product.ImageUrl || null
      const image = product.Image || null

      // Check ImgUrl/ImageUrl
      if (imgUrl !== null && imgUrl !== undefined) {
        stats.with_img_url++
        if (imgUrl === '') {
          stats.with_empty_img_url++
        } else {
          stats.products_with_images.push({
            id: product.Id,
            code: product.Code,
            name: product.Name,
            img_url: imgUrl,
          })
        }
      }

      // Check Image field
      if (image && image !== '') {
        stats.with_image++
      }

      // Check if product has any image
      if (!imgUrl && !image) {
        stats.without_any_image++
      }
    })

    console.log('Image stats:', stats)

    return new Response(
      JSON.stringify(stats, null, 2),
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
        error: errorMessage,
        details: 'Failed to check TPOS images' 
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
