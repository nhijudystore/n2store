import * as XLSX from "xlsx";
import { TPOS_CONFIG, getTPOSHeaders, cleanBase64, randomDelay } from "./tpos-config";
import { 
  COLORS, 
  TEXT_SIZES, 
  NUMBER_SIZES, 
  getVariantType,
  TPOS_ATTRIBUTE_IDS,
  TPOS_COLOR_MAP,
  TPOS_SIZE_TEXT_MAP,
  TPOS_SIZE_NUMBER_MAP
} from "./variant-attributes";

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
  tpos_product_id?: number | null;
}

export interface TPOSUploadResult {
  success: boolean;
  totalProducts: number;
  successCount: number;
  failedCount: number;
  savedIds: number;
  productsAddedToInventory?: number;
  errors: Array<{
    productName: string;
    productCode: string;
    errorMessage: string;
    fullError: any;
  }>;
  productIds: Array<{ itemId: string; tposId: number }>;
}

// =====================================================
// TPOS UTILITIES
// =====================================================

/**
 * Generate TPOS product link
 */
export function generateTPOSProductLink(productId: number): string {
  return `https://tomato.tpos.vn/#/app/producttemplate/form?id=${productId}`;
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
  const excelData = items.map((item) => ({
    "Loại sản phẩm": TPOS_CONFIG.DEFAULT_PRODUCT_TYPE,
    "Mã sản phẩm": item.product_code?.toString() || undefined,
    "Mã chốt đơn": undefined,
    "Tên sản phẩm": item.product_name?.toString() || undefined,
    "Giá bán": item.selling_price || 0,
    "Giá mua": item.unit_price || 0,
    "Đơn vị": TPOS_CONFIG.DEFAULT_UOM,
    "Nhóm sản phẩm": TPOS_CONFIG.DEFAULT_CATEGORY,
    "Mã vạch": item.product_code?.toString() || undefined,
    "Khối lượng": undefined,
    "Chiết khấu bán": undefined,
    "Chiết khấu mua": undefined,
    "Tồn kho": undefined,
    "Giá vốn": undefined,
    "Ghi chú": item.variant || undefined,
    "Cho phép bán ở công ty khác": "FALSE",
    "Thuộc tính": undefined,
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Đặt Hàng");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// =====================================================
// TPOS API CALLS
// =====================================================

export async function uploadExcelToTPOS(excelBlob: Blob): Promise<string> {
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      try {
        const base64Excel = cleanBase64(reader.result as string);
        
        if (!base64Excel) {
          throw new Error("Failed to convert Excel to base64");
        }

        const payload = {
          do_inventory: false,
          file: base64Excel,
          version: TPOS_CONFIG.API_VERSION,
        };

        console.log("📤 [TPOS] Uploading Excel...", {
          base64Length: base64Excel.length,
          version: TPOS_CONFIG.API_VERSION
        });

        const response = await fetch(`${TPOS_CONFIG.API_BASE}/ODataService.ActionImportSimple`, {
          method: "POST",
          headers: getTPOSHeaders(),
          body: JSON.stringify(payload),
        });

        console.log("Upload response status:", response.status);

        const responseText = await response.text();
        console.log("Upload response:", responseText);

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}\n${responseText}`);
        }

        let responseData;
        try {
          responseData = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
          responseData = { message: responseText };
        }

        console.log("✅ [TPOS] Excel uploaded successfully");
        resolve(responseText);
      } catch (error) {
        console.error("❌ uploadExcelToTPOS error:", error);
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

export async function getLatestProducts(count: number): Promise<any[]> {
  try {
    console.log(`📥 [TPOS] Fetching latest ${count} products...`);
    
    await randomDelay(400, 900);

    const response = await fetch(`${TPOS_CONFIG.API_BASE}/ODataService.GetViewV2`, {
      method: "GET",
      headers: getTPOSHeaders(),
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`Failed to fetch products: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const items = (data.value || data).filter(
      (item: any) => item.CreatedByName === TPOS_CONFIG.CREATED_BY_NAME
    );

    console.log(`🔍 [TPOS] Found ${items.length} products by ${TPOS_CONFIG.CREATED_BY_NAME}`);

    if (items.length === 0) {
      throw new Error(`Không tìm thấy sản phẩm của "${TPOS_CONFIG.CREATED_BY_NAME}"`);
    }

    // Sort by ID descending and take the latest products
    return items.sort((a: any, b: any) => b.Id - a.Id).slice(0, count);
  } catch (error) {
    console.error("❌ getLatestProducts error:", error);
    throw error;
  }
}

export async function getProductDetail(productId: number): Promise<any> {
  console.log(`🔎 [TPOS] Fetching product detail: ${productId}`);
  
  await randomDelay(200, 600);

  const expand = 'UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues),AttributeLines,UOMLines($expand=UOM),ComboProducts,ProductSupplierInfos';

  const response = await fetch(`${TPOS_CONFIG.API_BASE}(${productId})?$expand=${expand}`, {
    method: "GET",
    headers: getTPOSHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch product detail: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Check if products exist on TPOS (batch check)
 * Returns a Map of productId -> exists (true/false)
 */
export async function checkTPOSProductsExist(productIds: number[]): Promise<Map<number, boolean>> {
  if (productIds.length === 0) {
    return new Map();
  }

  console.log(`🔍 [TPOS] Checking existence of ${productIds.length} products...`);
  
  try {
    await randomDelay(300, 700);
    
    // Build filter to check multiple IDs at once
    const idFilter = productIds.map(id => `Id eq ${id}`).join(' or ');
    const filterQuery = encodeURIComponent(idFilter);
    
    // Fetch only ID and Name to minimize payload
    const response = await fetch(
      `${TPOS_CONFIG.API_BASE}/ODataService.GetViewV2?$filter=${filterQuery}&$select=Id,Name`,
      {
        method: "GET",
        headers: getTPOSHeaders(),
      }
    );

    if (!response.ok) {
      console.error(`❌ [TPOS] Check failed: ${response.status}`);
      // On error, assume all exist (fail-safe)
      const result = new Map<number, boolean>();
      productIds.forEach(id => result.set(id, true));
      return result;
    }

    const data = await response.json();
    const existingIds = new Set((data.value || data).map((p: any) => p.Id));
    
    // Create map of all requested IDs
    const result = new Map<number, boolean>();
    productIds.forEach(id => {
      result.set(id, existingIds.has(id));
    });

    const deletedCount = productIds.length - existingIds.size;
    console.log(`✅ [TPOS] Found ${existingIds.size}/${productIds.length} products (${deletedCount} deleted)`);
    
    return result;
  } catch (error) {
    console.error("❌ checkTPOSProductsExist error:", error);
    // On error, assume all exist (fail-safe)
    const result = new Map<number, boolean>();
    productIds.forEach(id => result.set(id, true));
    return result;
  }
}

// =====================================================
// ATTRIBUTES MANAGEMENT
// =====================================================

export interface TPOSAttribute {
  Id: number;
  Name: string;
  Code?: string;
}

export interface TPOSAttributesResponse {
  sizeText: TPOSAttribute[];
  sizeNumber: TPOSAttribute[];
  color: TPOSAttribute[];
}

export interface DetectedAttributes {
  sizeText?: string[];
  sizeNumber?: string[];
  color?: string[];
}

/**
 * Load danh sách thuộc tính từ TPOS
 */
export async function getTPOSAttributes(): Promise<TPOSAttributesResponse> {
  console.log("🎨 [TPOS] Loading attributes...");
  
  await randomDelay(300, 700);

  try {
    // Lấy danh sách attribute lines/values từ TPOS nếu có API
    // Hiện tại return data từ local constants
    const sizeText: TPOSAttribute[] = TEXT_SIZES.map((size, idx) => ({
      Id: 1000 + idx,
      Name: size,
      Code: size
    }));

    const sizeNumber: TPOSAttribute[] = NUMBER_SIZES.map((size, idx) => ({
      Id: 2000 + idx,
      Name: size,
      Code: `A${size}`
    }));

    const color: TPOSAttribute[] = COLORS.map((color, idx) => ({
      Id: 3000 + idx,
      Name: color,
      Code: color.substring(0, 2).toUpperCase()
    }));

    console.log(`✅ [TPOS] Loaded ${sizeText.length} size text, ${sizeNumber.length} size number, ${color.length} colors`);

    return { sizeText, sizeNumber, color };
  } catch (error) {
    console.error("❌ getTPOSAttributes error:", error);
    throw error;
  }
}

/**
 * Tự động detect thuộc tính từ text (tên sản phẩm, ghi chú)
 * 
 * REFACTORED: Now uses improved variant-detector.ts
 */
export function detectAttributesFromText(text: string): DetectedAttributes {
  if (!text) return {};

  // Import the new detection system
  const { detectVariantsFromText, getSimpleDetection } = require('./variant-detector');
  
  // Use new detection logic
  const result = detectVariantsFromText(text);
  const simple = getSimpleDetection(result);
  
  // Map to old format for backward compatibility
  const detected: DetectedAttributes = {};
  
  if (simple.color.length > 0) detected.color = simple.color;
  if (simple.sizeText.length > 0) detected.sizeText = simple.sizeText;
  if (simple.sizeNumber.length > 0) detected.sizeNumber = simple.sizeNumber;

  console.log("🎯 [TPOS] Detected attributes:", detected);
  return detected;
}

/**
 * Tạo AttributeValues cho TPOS product
 */
export function createAttributeValues(detected: DetectedAttributes): any[] {
  const attributeValues: any[] = [];

  // Helper để tìm attribute config
  const getAttributeConfig = (type: 'sizeText' | 'color' | 'sizeNumber') => {
    switch (type) {
      case 'sizeText':
        return { id: TPOS_ATTRIBUTE_IDS.SIZE_TEXT, name: "Size Chữ" };
      case 'color':
        return { id: TPOS_ATTRIBUTE_IDS.COLOR, name: "Màu" };
      case 'sizeNumber':
        return { id: TPOS_ATTRIBUTE_IDS.SIZE_NUMBER, name: "Size Số" };
    }
  };

  // Process size text
  if (detected.sizeText && detected.sizeText.length > 0) {
    const config = getAttributeConfig('sizeText');
    detected.sizeText.forEach(size => {
      const valueId = TPOS_SIZE_TEXT_MAP[size];
      if (valueId) {
        attributeValues.push({
          Id: valueId,
          Name: size,
          Code: null,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${size}`,
          DateCreated: null
        });
      }
    });
  }

  // Process colors
  if (detected.color && detected.color.length > 0) {
    const config = getAttributeConfig('color');
    detected.color.forEach(color => {
      const valueId = TPOS_COLOR_MAP[color];
      if (valueId) {
        attributeValues.push({
          Id: valueId,
          Name: color,
          Code: null,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${color}`,
          DateCreated: null
        });
      }
    });
  }

  // Process size number
  if (detected.sizeNumber && detected.sizeNumber.length > 0) {
    const config = getAttributeConfig('sizeNumber');
    detected.sizeNumber.forEach(size => {
      const valueId = TPOS_SIZE_NUMBER_MAP[size];
      if (valueId) {
        attributeValues.push({
          Id: valueId,
          Name: size,
          Code: null,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${size}`,
          DateCreated: null
        });
      }
    });
  }

  console.log("🎨 [TPOS] Created AttributeValues:", attributeValues);
  return attributeValues;
}

/**
 * Tạo AttributeLines cho TPOS product (format đầy đủ như backend)
 */
export function createAttributeLines(detected: DetectedAttributes): any[] {
  const attributeLines: any[] = [];

  // Helper để tìm attribute config
  const getAttributeConfig = (type: 'sizeText' | 'color' | 'sizeNumber') => {
    switch (type) {
      case 'sizeText':
        return { id: TPOS_ATTRIBUTE_IDS.SIZE_TEXT, name: "Size Chữ", code: "SZCh" };
      case 'color':
        return { id: TPOS_ATTRIBUTE_IDS.COLOR, name: "Màu", code: "Mau" };
      case 'sizeNumber':
        return { id: TPOS_ATTRIBUTE_IDS.SIZE_NUMBER, name: "Size Số", code: "SZNu" };
    }
  };

  // Process size text
  if (detected.sizeText && detected.sizeText.length > 0) {
    const config = getAttributeConfig('sizeText');
    const values = detected.sizeText
      .map(size => {
        const id = TPOS_SIZE_TEXT_MAP[size];
        if (!id) return null;
        return {
          Id: id,
          Name: size,
          Code: size,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${size}`,
          DateCreated: null
        };
      })
      .filter(v => v !== null);

    if (values.length > 0) {
      attributeLines.push({
        Attribute: {
          Id: config.id,
          Name: config.name,
          Code: config.code,
          Sequence: 1,
          CreateVariant: true
        },
        Values: values,
        AttributeId: config.id
      });
    }
  }

  // Process colors
  if (detected.color && detected.color.length > 0) {
    const config = getAttributeConfig('color');
    const values = detected.color
      .map(color => {
        const id = TPOS_COLOR_MAP[color];
        if (!id) return null;
        return {
          Id: id,
          Name: color,
          Code: color.toLowerCase().replace(/\s+/g, ''),
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${color}`,
          DateCreated: null
        };
      })
      .filter(v => v !== null);

    if (values.length > 0) {
      attributeLines.push({
        Attribute: {
          Id: config.id,
          Name: config.name,
          Code: config.code,
          Sequence: null,
          CreateVariant: true
        },
        Values: values,
        AttributeId: config.id
      });
    }
  }

  // Process size number
  if (detected.sizeNumber && detected.sizeNumber.length > 0) {
    const config = getAttributeConfig('sizeNumber');
    const values = detected.sizeNumber
      .map(size => {
        const id = TPOS_SIZE_NUMBER_MAP[size];
        if (!id) return null;
        return {
          Id: id,
          Name: size,
          Code: size,
          Sequence: null,
          AttributeId: config.id,
          AttributeName: config.name,
          PriceExtra: null,
          NameGet: `${config.name}: ${size}`,
          DateCreated: null
        };
      })
      .filter(v => v !== null);

    if (values.length > 0) {
      attributeLines.push({
        Attribute: {
          Id: config.id,
          Name: config.name,
          Code: config.code,
          Sequence: null,
          CreateVariant: true
        },
        Values: values,
        AttributeId: config.id
      });
    }
  }

  console.log("🎨 [TPOS] Created AttributeLines:", JSON.stringify(attributeLines, null, 2));
  return attributeLines;
}

export async function updateProductWithImage(
  productDetail: any,
  base64Image: string,
  detectedAttributes?: DetectedAttributes
): Promise<any> {
  console.log(`🖼️ [TPOS] Updating product ${productDetail.Id} with image...`);
  
  await randomDelay(300, 700);

  const payload = { ...productDetail };
  delete payload['@odata.context'];
  payload.Image = cleanBase64(base64Image);

  // Add attributes if detected
  if (detectedAttributes) {
    const attributeLines = createAttributeLines(detectedAttributes);
    
    if (attributeLines.length > 0) {
      payload.AttributeLines = attributeLines;
      console.log(`🎨 [TPOS] Adding ${attributeLines.length} attribute lines`);
    }
  }

  const response = await fetch(`${TPOS_CONFIG.API_BASE}/ODataService.UpdateV2`, {
    method: "POST",
    headers: getTPOSHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ TPOS update failed:", errorText);
    throw new Error(`Failed to update product: ${response.status} - ${errorText}`);
  }

  console.log(`✅ [TPOS] Product ${productDetail.Id} updated`);
  return response.json();
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
    console.log("📊 Excel generated, size:", excelBlob.size);

    // Step 2: Upload Excel to TPOS
    onProgress?.(2, 3, "Đang upload Excel lên TPOS...");
    const uploadResponse = await uploadExcelToTPOS(excelBlob);
    console.log("✅ Excel uploaded successfully");
    
    // Wait for TPOS to process
    onProgress?.(2, 3, "Đợi TPOS xử lý file...");
    await new Promise(r => setTimeout(r, 1000));

    // Step 3: Get created products
    onProgress?.(3, 3, "Đang lấy danh sách sản phẩm...");
    const latestProducts = await getLatestProducts(items.length);
    console.log(`📦 Fetched ${latestProducts.length} products`);

    // Step 4: Update products with images (index-based matching)
    for (let i = 0; i < latestProducts.length; i++) {
      const product = latestProducts[i];
      const item = items[i];

      if (!item) continue;

      try {
        const imageUrl = item.product_images?.[0];
        
        // Auto-detect attributes từ tên sản phẩm và variant
        const textToAnalyze = `${item.product_name} ${item.variant || ''}`.trim();
        const detectedAttributes = detectAttributesFromText(textToAnalyze);
        
        if (imageUrl) {
          onProgress?.(3, 3, `Upload ảnh ${i + 1}/${items.length}: ${item.product_name}...`);
          
          const base64Image = await imageUrlToBase64(imageUrl);
          if (base64Image) {
            const detail = await getProductDetail(product.Id);
            await updateProductWithImage(detail, base64Image, detectedAttributes);
          }
        } else if (Object.keys(detectedAttributes).length > 0) {
          // Nếu không có ảnh nhưng có attributes, vẫn update
          const detail = await getProductDetail(product.Id);
          await updateProductWithImage(detail, detail.Image || '', detectedAttributes);
        }

        // ✅ CHỈ thêm vào productIds khi upload THÀNH CÔNG
        result.productIds.push({
          itemId: item.id,
          tposId: product.Id,
        });
        result.successCount++;
        console.log(`✅ [${i + 1}/${items.length}] ${item.product_name} -> TPOS ID: ${product.Id}`);
      } catch (error) {
        // ❌ Capture TOÀN BỘ error info
        let errorDetail = '';
        
        if (error instanceof Error) {
          errorDetail = error.message;
          // Parse JSON error response nếu có
          try {
            const errorJson = JSON.parse(error.message);
            errorDetail = JSON.stringify(errorJson, null, 2);
          } catch {
            // Keep original error.message if not JSON
          }
        } else {
          errorDetail = JSON.stringify(error, null, 2);
        }
        
        result.errors.push({
          productName: item.product_name,
          productCode: item.product_code || 'N/A',
          errorMessage: errorDetail,
          fullError: error,
        });
        
        result.failedCount++;
        console.error(`❌ [${i + 1}/${items.length}] FAILED: ${item.product_name}`, error);
        
        // ⚠️ KHÔNG thêm vào productIds → KHÔNG lưu database
      }
    }

    result.success = true;
    console.log("=".repeat(60));
    console.log(`✅ Upload hoàn tất: ${result.successCount}/${items.length}`);
    console.log(`❌ Thất bại: ${result.failedCount}`);
    console.log("=".repeat(60));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push({
      productName: 'General Upload Error',
      productCode: 'N/A',
      errorMessage: errorMsg,
      fullError: error,
    });
    console.error("❌ Upload error:", error);
  }

  return result;
}
