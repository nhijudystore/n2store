import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    'accept': 'application/json, text/plain, */*',
    'authorization': `Bearer ${bearerToken}`,
    'content-type': 'application/json;charset=UTF-8',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'tposappversion': '5.9.10.1',
    'x-request-id': generateRandomId(),
    'x-requested-with': 'XMLHttpRequest',
    'Referer': 'https://tomato.tpos.vn/',
  };
}

function convertFacebookTimeToISO(facebookTime: string): string {
  // Facebook format: "2025-10-09T08:43:42+0000"
  // TPOS format:     "2025-10-09T08:43:42.000Z"
  return facebookTime.replace('+0000', '.000Z');
}

async function fetchLiveCampaignId(postId: string, bearerToken: string): Promise<string | null> {
  try {
    console.log('Fetching LiveCampaignId for post:', postId);
    
    const response = await fetch(
      "https://tomato.tpos.vn/rest/v1.0/facebookpost/get_saved_by_ids",
      {
        method: "POST",
        headers: getTPOSHeaders(bearerToken),
        body: JSON.stringify({
          PostIds: [postId],
          TeamId: 10037
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch LiveCampaignId:', response.status, errorText);
      console.log('LiveCampaignId not found, will proceed without it');
      return null;
    }

    const data = await response.json();
    console.log("LiveCampaign API response:", JSON.stringify(data, null, 2));

    if (Array.isArray(data) && data.length > 0 && data[0].LiveCampaignId) {
      console.log('Found LiveCampaignId:', data[0].LiveCampaignId);
      return data[0].LiveCampaignId;
    }

    console.log(`LiveCampaignId is null for post: ${postId}. This post may need to be configured in TPOS first.`);
    return null;
  } catch (error) {
    console.error('Error fetching LiveCampaignId:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let payload: any = null;

  try {
    const { comment, video } = await req.json();

    if (!comment || !video) {
      throw new Error('Comment and video data are required');
    }

    const bearerToken = Deno.env.get('FACEBOOK_BEARER_TOKEN');
    if (!bearerToken) {
      throw new Error('Facebook bearer token not configured');
    }

    // Fetch LiveCampaignId dynamically
    const liveCampaignId = await fetchLiveCampaignId(video.objectId, bearerToken);

    if (!liveCampaignId) {
      return new Response(
        JSON.stringify({ 
          error: 'LiveCampaignId không tìm thấy. Vui lòng cấu hình live campaign cho post này trong TPOS trước.',
          postId: video.objectId 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tposUrl = "https://tomato.tpos.vn/odata/SaleOnline_Order?IsIncrease=True&$expand=Details,User,Partner($expand=Addresses)";

    // Clean comment object - chỉ giữ fields TPOS API cần
    const cleanComment = {
      id: comment.id,
      is_hidden: comment.is_hidden,
      message: comment.message,
      created_time: comment.created_time,
      created_time_converted: convertFacebookTimeToISO(comment.created_time),
      from: {
        id: comment.from.id,
        name: comment.from.name
      }
    };

    payload = {
      "CRMTeamId": 10037,
      "LiveCampaignId": liveCampaignId,
      "Facebook_PostId": video.objectId,
      "Facebook_ASUserId": comment.from.id,
      "Facebook_UserName": comment.from.name,
      "Facebook_CommentId": comment.id,
      "Name": comment.from.name,
      "PartnerName": comment.from.name,
      "Details": [],
      "TotalAmount": 0,
      "Facebook_Comments": [cleanComment],
      "WarehouseId": 1,
      "CompanyId": 1,
      "TotalQuantity": 0,
      "Note": `{before}${comment.message}`,
      "DateCreated": new Date().toISOString(),
    };

    console.log("Sending payload to TPOS:", JSON.stringify(payload, null, 2));

    const response = await fetch(tposUrl, {
      method: "POST",
      headers: getTPOSHeaders(bearerToken),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TPOS API error:', errorText);
      // Return payload even on error for debugging
      return new Response(
        JSON.stringify({ payload, error: `TPOS API error: ${response.status} - ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log("TPOS response:", data);

    // Save to facebook_pending_orders table
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
      } else {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { error: insertError } = await supabase
          .from('facebook_pending_orders')
          .insert({
            name: data.Name || comment.from.name,
            session_index: data.SessionIndex?.toString() || null,
            code: data.Code || null,
            phone: data.Telephone || null,
            comment: comment.message || null,
            created_time: convertFacebookTimeToISO(comment.created_time),
            tpos_order_id: data.Id || null,
            facebook_comment_id: comment.id,
            facebook_user_id: comment.from.id,
            facebook_post_id: video.objectId,
          });

        if (insertError) {
          console.error('Error saving to facebook_pending_orders:', insertError);
        } else {
          console.log('Successfully saved to facebook_pending_orders');
        }
      }
    } catch (dbError) {
      console.error('Exception saving to database:', dbError);
    }

    // Return both payload and response
    return new Response(JSON.stringify({ payload, response: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-tpos-order-from-comment function:', error);
    return new Response(
      JSON.stringify({ payload, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});