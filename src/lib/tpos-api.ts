import * as XLSX from "xlsx";
import { TPOS_CONFIG, getTPOSHeaders, cleanBase64, randomDelay } from "./tpos-config";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface TPOSProductItem {
  id: string;
  product_code: string | null;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  selling_price: number;
  product_images: string[] | null;
  price_images: string[] | null;
  purchase_order_id: string;
  supplier_name: string;
}

export interface TPOSUploadResult {
  success: boolean;
  totalProducts: number;
  successCount: number;
  failedCount: number;
  savedIds: number;
  errors: string[];
  productIds: Array<{ itemId: string; tposId: number }>;
}

// =====================================================
// IMAGE CONVERSION
// =====================================================

export async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(cleanBase64(base64));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return null;
  }
}

// =====================================================
// EXCEL GENERATION
// =====================================================

export function generateTPOSExcel(items: TPOSProductItem[]): Blob {
  const excelData = items.map((item, index) => ({
    "STT": index + 1,
    "Tên sản phẩm": item.product_name,
    "Mã sản phẩm": item.product_code || `AUTO-${Date.now()}-${index}`,
    "Loại sản phẩm": TPOS_CONFIG.DEFAULT_PRODUCT_TYPE,
    "Danh mục": TPOS_CONFIG.DEFAULT_CATEGORY,
    "ĐVT": TPOS_CONFIG.DEFAULT_UOM,
    "Giá bán": item.selling_price || 0,
    "Giá vốn": item.unit_price || 0,
    "Tồn kho": 0,
    "Người tạo": TPOS_CONFIG.CREATED_BY_NAME,
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// =====================================================
// TPOS API CALLS
// =====================================================

export async function uploadExcelToTPOS(excelBlob: Blob): Promise<void> {
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      try {
        const base64Excel = cleanBase64(reader.result as string);
        
        if (!base64Excel) {
          throw new Error("Failed to convert Excel to base64");
        }

        const payload = {
          ActionName: "ActionImportSimple",
          ProductTemplate: { Id: 0 },
          FileBase64String: base64Excel,
          FileName: `TPOS_Import_${Date.now()}.xlsx`,
        };

        console.log("Uploading Excel to TPOS...", {
          fileName: payload.FileName,
          base64Length: base64Excel.length
        });

        const response = await fetch(TPOS_CONFIG.API_BASE, {
          method: "POST",
          headers: getTPOSHeaders(),
          body: JSON.stringify(payload),
        });

        console.log("Upload response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Upload error response:", errorText);
          throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const responseData = await response.json();
        console.log("Upload response data:", responseData);

        resolve();
      } catch (error) {
        console.error("uploadExcelToTPOS error:", error);
        reject(error);
      }
    };

    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      reject(error);
    };
    
    reader.readAsDataURL(excelBlob);
  });
}

export async function getLatestProducts(limit = 100): Promise<any[]> {
  try {
    // Try with filter first
    let url = `${TPOS_CONFIG.API_BASE}?$orderby=CreatedDate desc&$top=${limit}`;
    
    // Add filter for created by user (optional - may not work on all TPOS versions)
    if (TPOS_CONFIG.CREATED_BY_NAME) {
      url += `&$filter=CreatedBy eq '${TPOS_CONFIG.CREATED_BY_NAME}'`;
    }

    console.log("Fetching products from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: getTPOSHeaders(),
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      
      // If filter fails, try without filter
      if (response.status === 400 || response.status === 500) {
        console.log("Retrying without filter...");
        const simpleUrl = `${TPOS_CONFIG.API_BASE}?$orderby=CreatedDate desc&$top=${limit}`;
        const retryResponse = await fetch(simpleUrl, {
          method: "GET",
          headers: getTPOSHeaders(),
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Failed to fetch products: ${retryResponse.statusText}`);
        }
        
        const data = await retryResponse.json();
        return data.value || [];
      }
      
      throw new Error(`Failed to fetch products: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Fetched products count:", data.value?.length || 0);
    return data.value || [];
  } catch (error) {
    console.error("getLatestProducts error:", error);
    throw error;
  }
}

export async function getProductDetail(productId: number): Promise<any> {
  const url = `${TPOS_CONFIG.API_BASE}(${productId})`;

  const response = await fetch(url, {
    method: "GET",
    headers: getTPOSHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch product detail: ${response.statusText}`);
  }

  return response.json();
}

export async function updateProductWithImage(
  productId: number,
  base64Image: string
): Promise<void> {
  const payload = {
    ProductImages: [
      {
        ImageData: base64Image,
        IsDefault: true,
      },
    ],
  };

  const url = `${TPOS_CONFIG.API_BASE}(${productId})`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: getTPOSHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update product image: ${response.statusText}`);
  }
}

// =====================================================
// MAIN UPLOAD FLOW
// =====================================================

export async function uploadToTPOS(
  items: TPOSProductItem[],
  onProgress?: (step: number, total: number, message: string) => void
): Promise<TPOSUploadResult> {
  const result: TPOSUploadResult = {
    success: false,
    totalProducts: items.length,
    successCount: 0,
    failedCount: 0,
    savedIds: 0,
    errors: [],
    productIds: [],
  };

  try {
    // Step 1: Generate Excel
    onProgress?.(1, 3, "Đang tạo file Excel...");
    const excelBlob = generateTPOSExcel(items);
    console.log("Excel generated, size:", excelBlob.size);

    // Step 2: Upload Excel to TPOS
    onProgress?.(2, 3, "Đang upload Excel lên TPOS...");
    await uploadExcelToTPOS(excelBlob);
    console.log("Excel uploaded successfully");
    
    // Wait longer for TPOS to process
    onProgress?.(2, 3, "Đợi TPOS xử lý file...");
    await randomDelay(3000, 5000); // Increase wait time to 3-5 seconds

    // Step 3: Get created products and update with images
    onProgress?.(3, 3, "Đang lấy danh sách sản phẩm...");
    let latestProducts = await getLatestProducts(items.length * 2); // Get more products to ensure we catch all
    console.log("Fetched products:", latestProducts.length);

    // Filter by created by name if not done by API
    if (TPOS_CONFIG.CREATED_BY_NAME) {
      latestProducts = latestProducts.filter(
        (p) => p.CreatedBy === TPOS_CONFIG.CREATED_BY_NAME
      );
      console.log("Filtered products by CreatedBy:", latestProducts.length);
    }

    // Match products by name
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const matchedProduct = latestProducts.find(
        (p) => p.Name?.trim().toLowerCase() === item.product_name?.trim().toLowerCase()
      );

      if (matchedProduct) {
        try {
          // Get first product image if available
          const imageUrl = item.product_images?.[0];
          
          if (imageUrl) {
            onProgress?.(3, 3, `Đang upload ảnh cho ${item.product_name}...`);
            const base64Image = await imageUrlToBase64(imageUrl);
            if (base64Image) {
              await updateProductWithImage(matchedProduct.Id, base64Image);
              await randomDelay(500, 1000); // Longer delay between image uploads
            }
          }

          result.productIds.push({
            itemId: item.id,
            tposId: matchedProduct.Id,
          });
          result.successCount++;
          console.log(`✓ Matched: ${item.product_name} -> TPOS ID: ${matchedProduct.Id}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`${item.product_name}: ${errorMsg}`);
          result.failedCount++;
          console.error(`✗ Error with ${item.product_name}:`, error);
        }
      } else {
        result.errors.push(`Không tìm thấy sản phẩm: ${item.product_name}`);
        result.failedCount++;
        console.warn(`✗ Not found: ${item.product_name}`);
      }

      onProgress?.(
        3,
        3,
        `Đã xử lý ${i + 1}/${items.length} sản phẩm...`
      );
    }

    result.success = true;
    console.log("Upload completed:", result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Upload failed: ${errorMsg}`);
    console.error("Upload error:", error);
  }

  return result;
}
