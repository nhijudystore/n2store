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
		const { product_code, fallback_name, fallback_price } = await req.json();

		if (!product_code) {
			throw new Error("product_code is required");
		}

		const bearerToken = Deno.env.get("FACEBOOK_BEARER_TOKEN");
		if (!bearerToken) {
			throw new Error("Facebook bearer token not configured");
		}

		// Call TPOS GetViewV2 API
		const url = `https://tomato.tpos.vn/odata/Product/OdataService.GetViewV2?Active=true&Name=${encodeURIComponent(
			product_code,
		)}&$top=50&$orderby=DateCreated+desc&$count=true`;

		console.log(`Fetching TPOS product details for: ${product_code}`);

		const response = await fetch(url, {
			method: "GET",
			headers: getTPOSHeaders(bearerToken),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`TPOS API error (${response.status}):`,
				errorText,
			);
			throw new Error(
				`Failed to fetch TPOS product (${response.status}): ${errorText}`,
			);
		}

		const data = await response.json();

		if (!data.value || data.value.length === 0) {
			console.warn(`No product found in TPOS for code: ${product_code}`);
			
			// Return fallback values if available
			if (fallback_name) {
				return new Response(
					JSON.stringify({
						ProductId: null,
						ProductName: fallback_name,
						ProductNameGet: `[${product_code}] ${fallback_name}`,
						Price: fallback_price || 0,
						error: "Product not found in TPOS, using fallback values",
					}),
					{
						headers: {
							...corsHeaders,
							"Content-Type": "application/json",
						},
					},
				);
			}
			
			throw new Error(
				`Không tìm thấy sản phẩm ${product_code} trên TPOS`,
			);
		}

		const product = data.value[0];

		const result = {
			ProductId: product.Id,
			ProductName: product.Name,
			ProductNameGet: product.NameGet,
			Price: product.PriceVariant || product.ListPrice || 0,
		};

		console.log(
			`Successfully fetched TPOS product details:`,
			JSON.stringify(result),
		);

		return new Response(JSON.stringify(result), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error in get-tpos-product-details function:", error);
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
