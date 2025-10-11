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
		const { tposOrderId, productToAdd, quantity } = await req.json();

		if (!tposOrderId || !productToAdd || !quantity) {
			throw new Error(
				"tposOrderId, productToAdd, and quantity are required",
			);
		}

		const bearerToken = Deno.env.get("FACEBOOK_BEARER_TOKEN");
		if (!bearerToken) {
			throw new Error("Facebook bearer token not configured");
		}

		// Step 1: GET existing order from TPOS
		const getUrl = `https://tomato.tpos.vn/odata/SaleOnline_Order(${tposOrderId})?$expand=Details,Partner,User,CRMTeam`;
		const getResponse = await fetch(getUrl, {
			method: "GET",
			headers: getTPOSHeaders(bearerToken),
		});

		if (!getResponse.ok) {
			const errorText = await getResponse.text();
			throw new Error(
				`Failed to GET TPOS order (${getResponse.status}): ${errorText}`,
			);
		}

		const currentOrderData = await getResponse.json();

		// Step 2: Prepare the new product detail
		const newDetail = {
			ProductId: productToAdd.productid_bienthe,
			ProductName: productToAdd.product_name,
			ProductNameGet: `[${productToAdd.product_code}] ${productToAdd.product_name}`,
			UOMId: 1,
			UOMName: "Cái",
			Quantity: quantity,
			Price: productToAdd.selling_price,
			Factor: 1,
			ProductWeight: 0,
		};

		// Step 3: Create the PUT payload by appending the new detail
		const updatedDetails = [...(currentOrderData.Details || []), newDetail];

		const updatePayload = {
			...currentOrderData,
			Details: updatedDetails,
		};

		// Clean up payload
		delete updatePayload["@odata.context"];

		// Step 4: PUT the updated order to TPOS
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
			throw new Error(
				`Failed to PUT TPOS order (${putResponse.status}): ${errorText}`,
			);
		}

		// TPOS PUT returns 204 No Content on success
		return new Response(
			JSON.stringify({
				success: true,
				message: "Product added to TPOS order",
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
