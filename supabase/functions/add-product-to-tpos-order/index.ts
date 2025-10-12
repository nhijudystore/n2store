import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

function generateRandomId(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
		/[xy]/g,
		function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		},
	);
}

function getTPOSHeaders(bearerToken: string) {
	return {
		accept: "application/json, text/plain, */*",
		authorization: `Bearer ${bearerToken}`,
		"content-type": "application/json;charset=UTF-8",
		"user-agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		tposappversion: "5.9.10.1",
		"x-request-id": generateRandomId(),
		"x-requested-with": "XMLHttpRequest",
		Referer: "https://tomato.tpos.vn/",
	};
}

serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders });
	}

	try {
		const { tposOrderId, fullDetails } = await req.json();

		if (!tposOrderId || !fullDetails || !Array.isArray(fullDetails)) {
			throw new Error("tposOrderId and fullDetails array are required");
		}

		const bearerToken = Deno.env.get("FACEBOOK_BEARER_TOKEN");
		if (!bearerToken) {
			throw new Error("Facebook bearer token not configured");
		}

		// Prepare the PUT payload with full details
		// Remove product_code field added for reference
		const cleanDetails = fullDetails.map(({ product_code, ...detail }) => detail);
		
		const updatePayload = {
			Id: tposOrderId,
			Details: cleanDetails,
		};

		console.log(`Updating TPOS order ${tposOrderId} with ${cleanDetails.length} products`);

		// PUT the updated order to TPOS
		const putUrl = `https://tomato.tpos.vn/odata/SaleOnline_Order(${tposOrderId})`;
		const putResponse = await fetch(putUrl, {
			method: "PUT",
			headers: {
				...getTPOSHeaders(bearerToken),
				"Content-Type": "application/json;charset=UTF-8",
			},
			body: JSON.stringify(updatePayload),
		});

		if (!putResponse.ok) {
			const errorText = await putResponse.text();
			console.error(`TPOS PUT failed (${putResponse.status}):`, errorText);
			throw new Error(
				`Failed to PUT TPOS order (${putResponse.status}): ${errorText}`,
			);
		}

		console.log(`Successfully updated TPOS order ${tposOrderId}`);

		// TPOS PUT returns 204 No Content on success
		return new Response(
			JSON.stringify({
				success: true,
				message: "Products updated in TPOS order",
				product_count: cleanDetails.length,
			}),
			{
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error in add-product-to-tpos-order function:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			},
		);
	}
});
