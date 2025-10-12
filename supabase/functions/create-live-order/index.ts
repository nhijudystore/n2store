import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productId, phaseId, sessionId, orderCode } = await req.json();

    if (!productId || !orderCode) {
      throw new Error('Missing required fields');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Creating order ${orderCode} for product ${productId}`);

    // 1. Get current product data
    const { data: product, error: fetchError } = await supabase
      .from('live_products')
      .select('sold_quantity, prepared_quantity, product_code, product_name')
      .eq('id', productId)
      .single();

    if (fetchError) {
      console.error('Error fetching product:', fetchError);
      throw fetchError;
    }

    // 2. Check if overselling
    const newSoldQuantity = (product.sold_quantity || 0) + 1;
    const isOversell = newSoldQuantity > product.prepared_quantity;

    console.log(`Product ${product.product_code}: sold ${product.sold_quantity} → ${newSoldQuantity}, prepared ${product.prepared_quantity}, oversell: ${isOversell}`);

    // 3. Insert order
    const { error: orderError } = await supabase
      .from('live_orders')
      .insert({
        order_code: orderCode.trim(),
        live_session_id: sessionId,
        live_phase_id: phaseId,
        live_product_id: productId,
        quantity: 1,
        is_oversell: isOversell
      });

    if (orderError) {
      console.error('Error inserting order:', orderError);
      throw orderError;
    }

    // 4. Update sold quantity
    const { error: updateError } = await supabase
      .from('live_products')
      .update({ sold_quantity: newSoldQuantity })
      .eq('id', productId);

    if (updateError) {
      console.error('Error updating product:', updateError);
      throw updateError;
    }

    console.log(`Successfully created order ${orderCode}`);

    return new Response(
      JSON.stringify({ success: true, isOversell, orderCode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-live-order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
