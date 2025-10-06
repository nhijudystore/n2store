const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bearerToken } = await req.json();
    
    if (!bearerToken) {
      throw new Error('Bearer token is required');
    }
    
    // Get required secrets
    const accessToken = Deno.env.get('SUPABASE_ACCESS_TOKEN');
    const projectRef = 'xneoovjmwhzzphwlwojc';
    
    if (!accessToken) {
      throw new Error('SUPABASE_ACCESS_TOKEN not configured');
    }
    
    console.log('📝 Updating TPOS_BEARER_TOKEN secret in Supabase...');
    
    // Call Supabase Management API to update secret
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            name: 'TPOS_BEARER_TOKEN',
            value: bearerToken
          }
        ])
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to update secret:', errorText);
      throw new Error(`Failed to update secret: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ TPOS_BEARER_TOKEN secret updated successfully');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'TPOS Bearer Token đã được cập nhật thành công vào Supabase Secrets',
        details: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error updating TPOS token:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as Error).message 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
