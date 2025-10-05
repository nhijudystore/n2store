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

    console.log('Fetching all TPOS products...')

    // Fetch all products from TPOS (no pagination needed with OData)
    // Using $top to get all products (max 10000)
    const response = await fetch(
      `https://ghn.mfast.vn/api/products?$top=10000&$expand=Images`,
      {
        headers: {
          'Authorization': `Bearer ${TPOS_BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch TPOS products: ${response.status}`)
    }

    const data = await response.json()
    const allProducts: TPOSProduct[] = data.value || data

    console.log(`Total products fetched: ${allProducts.length}`)

    // Analyze image URLs
    const stats = {
      total_products: allProducts.length,
      with_img_url: 0,
      with_empty_img_url: 0,
      with_image: 0,
      with_image_url: 0,
      without_any_image: 0,
      products_with_images: [] as { id: number; code: string; name: string; img_url: string | null }[],
    }

    allProducts.forEach(product => {
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
