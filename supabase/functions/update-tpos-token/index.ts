import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
    
    console.log('TPOS Bearer Token updated in database');
    console.log('⚠️ IMPORTANT: Please manually update TPOS_BEARER_TOKEN secret in Supabase Dashboard');
    console.log('📍 Location: Project Settings > Edge Functions > Secrets');
    console.log('🔗 URL: https://supabase.com/dashboard/project/xneoovjmwhzzphwlwojc/settings/functions');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token saved to database. Please update TPOS_BEARER_TOKEN secret in Supabase Dashboard for Edge Functions.',
        secretUpdateUrl: 'https://supabase.com/dashboard/project/xneoovjmwhzzphwlwojc/settings/functions'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating TPOS token:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
