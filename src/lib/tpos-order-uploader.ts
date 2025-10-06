import { getTPOSHeaders, getActiveTPOSToken } from "./tpos-config";

// Generate random UUID for x-request-id
const generateRandomId = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Get TPOS headers with bearer token
const getTPOSRequestHeaders = async () => {
  const token = await getActiveTPOSToken();
  if (!token) {
    throw new Error("TPOS Bearer Token chưa được cấu hình");
  }

  return {
    accept: "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    authorization: `Bearer ${token}`,
    "content-type": "application/json;charset=UTF-8",
    origin: "https://tomato.tpos.vn",
    referer: "https://tomato.tpos.vn/",
    "sec-ch-ua": '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    tposappversion: "5.9.10.1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "x-request-id": generateRandomId(),
  };
};

interface TPOSOrderDetail {
  ProductId: number;
  ProductName: string;
  ProductNameGet: string;
  UOMId: number;
  UOMName: string;
  Quantity: number;
  Price: number;
  Factor: number;
  ProductWeight: number;
}

interface TPOSOrderData {
  Id: number;
  TotalAmount: number;
  TotalQuantity: number;
  PrintCount: number;
  Details: TPOSOrderDetail[];
  [key: string]: any;
}

interface UploadOrderItem {
  tpos_order_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  tpos_product_id?: number;
  selling_price?: number;
}

export interface UploadResult {
  success: boolean;
  orderId: string;
  message: string;
  error?: string;
}

/**
 * Get order data from TPOS
 */
export const getTPOSOrderData = async (orderId: string): Promise<TPOSOrderData> => {
  const headers = await getTPOSRequestHeaders();
  
  const response = await fetch(
    `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})?$expand=Details,Partner,User,CRMTeam`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Update order on TPOS with new product details
 */
export const updateTPOSOrder = async (
  orderId: string,
  orderData: TPOSOrderData,
  productDetails: {
    productId: number;
    productName: string;
    productNameGet: string;
    quantity: number;
    price: number;
  }
): Promise<any> => {
  const headers = await getTPOSRequestHeaders();
  
  const { quantity, price } = productDetails;
  const totalAmount = quantity * price;
  const totalQuantity = quantity;

  const updatePayload = {
    ...orderData,
    TotalAmount: totalAmount,
    TotalQuantity: totalQuantity,
    PrintCount: (orderData.PrintCount || 0) + 1,
    Details: [
      {
        ProductId: productDetails.productId,
        ProductName: productDetails.productName,
        ProductNameGet: productDetails.productNameGet,
        UOMId: 1,
        UOMName: "Cái",
        Quantity: quantity,
        Price: price,
        Factor: 1,
        ProductWeight: 0,
      },
    ],
  };

  // Remove @odata.context if exists
  delete updatePayload["@odata.context"];

  const response = await fetch(
    `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(updatePayload),
    }
  );

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Lỗi ${response.status}`);
    } else {
      const errorText = await response.text();
      throw new Error(`Lỗi ${response.status}: ${errorText || response.statusText}`);
    }
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  }
  
  return { success: true, status: response.status };
};

/**
 * Upload single order to TPOS
 */
export const uploadOrderToTPOS = async (
  item: UploadOrderItem
): Promise<UploadResult> => {
  try {
    if (!item.tpos_order_id) {
      throw new Error("Không có TPOS Order ID");
    }

    if (!item.tpos_product_id) {
      throw new Error("Không có TPOS Product ID");
    }

    // Step 1: GET order data from TPOS
    const orderData = await getTPOSOrderData(item.tpos_order_id);

    // Step 2: Prepare product details
    const productDetails = {
      productId: item.tpos_product_id,
      productName: item.product_name,
      productNameGet: `[${item.product_code}] ${item.product_name}`,
      quantity: item.quantity,
      price: item.selling_price || 0,
    };

    // Step 3: PUT updated order back to TPOS
    await updateTPOSOrder(item.tpos_order_id, orderData, productDetails);

    return {
      success: true,
      orderId: item.tpos_order_id,
      message: "Cập nhật thành công",
    };
  } catch (error: any) {
    console.error(`Error uploading order ${item.tpos_order_id}:`, error);
    return {
      success: false,
      orderId: item.tpos_order_id || "",
      message: "Lỗi upload",
      error: error.message,
    };
  }
};
