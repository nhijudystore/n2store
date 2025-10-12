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

		console.log(`Fetching existing TPOS order ${tposOrderId}`);

		// Step 1: GET existing order from TPOS
		const getUrl = `https://tomato.tpos.vn/odata/SaleOnline_Order(${tposOrderId})`;
		const getResponse = await fetch(getUrl, {
			method: "GET",
			headers: getTPOSHeaders(bearerToken),
		});

		if (!getResponse.ok) {
			const errorText = await getResponse.text();
			console.error(`TPOS GET failed (${getResponse.status}):`, errorText);
			throw new Error(
				`Failed to GET TPOS order (${getResponse.status}): ${errorText}`,
			);
		}

		const existingOrder = await getResponse.json();
		const existingDetails = existingOrder.Details || [];

		console.log(`Found ${existingDetails.length} existing products in order`);

		// Step 2: Prepare new details (remove product_code field)
		const newDetails = fullDetails.map(({ product_code, ...detail }: any) => detail);

		// Step 3: Merge Details - use Map to handle duplicates by ProductId
		const mergedDetailsMap = new Map<number, any>();

		// Add existing details to Map
		existingDetails.forEach((detail: any) => {
			mergedDetailsMap.set(detail.ProductId, detail);
		});

		// Add/Update new details (sum Quantity if ProductId exists)
		newDetails.forEach((detail: any) => {
			if (mergedDetailsMap.has(detail.ProductId)) {
				// Product exists - sum quantities
				const existing = mergedDetailsMap.get(detail.ProductId);
				mergedDetailsMap.set(detail.ProductId, {
					...detail,
					Quantity: existing.Quantity + detail.Quantity,
				});
				console.log(`Updated quantity for ProductId ${detail.ProductId}: ${existing.Quantity} + ${detail.Quantity} = ${existing.Quantity + detail.Quantity}`);
			} else {
				// New product - add it
				mergedDetailsMap.set(detail.ProductId, detail);
				console.log(`Added new product: ProductId ${detail.ProductId}`);
			}
		});

		// Step 4: Convert Map back to array
		const mergedDetails = Array.from(mergedDetailsMap.values());

		const updatePayload = {
			Id: tposOrderId,
			Details: mergedDetails,
		};

		console.log(`Updating TPOS order ${tposOrderId} with ${mergedDetails.length} total products`);

		// Step 5: PUT the merged details back to TPOS
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
				message: "Products merged and updated in TPOS order",
				product_count: mergedDetails.length,
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
