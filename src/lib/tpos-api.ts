import * as XLSX from "xlsx";
import { TPOS_CONFIG, getTPOSHeaders, getActiveTPOSToken, cleanBase64, randomDelay } from "./tpos-config";
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
import { detectVariantsFromText, getSimpleDetection } from "./variant-detector";
import { supabase } from "@/integrations/supabase/client";

// =====================================================
// CACHE MANAGEMENT
// =====================================================

const CACHE_KEY = 'tpos_product_cache';
const CACHE_TTL = 1000 * 60 * 30; // 30 phút

/**
 * Lấy cached TPOS IDs từ localStorage
 */
export function getCachedTPOSIds(): Map<string, number> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return new Map();
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Check TTL
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return new Map();
    }
    
    return new Map(Object.entries(data));
  } catch (error) {
    console.error('❌ Cache read error:', error);
    return new Map();
  }
}

/**
 * Lưu TPOS IDs vào localStorage
 */
export function saveCachedTPOSIds(ids: Map<string, number>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: Object.fromEntries(ids),
      timestamp: Date.now()
    }));
    console.log(`💾 Cached ${ids.size} TPOS IDs (TTL: 30 phút)`);
  } catch (error) {
    console.error('❌ Cache write error:', error);
  }
}

/**
 * Xóa cache (dùng khi cần refresh)
 */
export function clearTPOSCache() {
  localStorage.removeItem(CACHE_KEY);
  console.log('🗑️ TPOS Cache cleared');
}

// =====================================================
// TPOS PRODUCT SYNC FUNCTIONS
// =====================================================

interface TPOSProduct {
  Id: number;
  DefaultCode: string;
  Name: string;
  Active: boolean;
}

interface SyncTPOSProductIdsResult {
  matched: number;
  notFound: number;
  errors: number;
  details: {
    product_code: string;
    tpos_id?: number;
    error?: string;
  }[];
}

/**
 * Fetch TPOS Products with pagination
 */
async function fetchTPOSProducts(skip: number = 0): Promise<TPOSProduct[]> {
  const token = await getActiveTPOSToken();
  if (!token) {
    throw new Error("TPOS Bearer Token not found. Please configure in Settings.");
  }
  
  const url = `https://tomato.tpos.vn/odata/Product/ODataService.GetViewV2?Active=true&$top=1000&$skip=${skip}&$orderby=DateCreated desc&$filter=Active eq true&$count=true`;
  
  console.log(`[TPOS Product Sync] Fetching from skip=${skip}`);
  
  const response = await fetch(url, {
    headers: getTPOSHeaders(token)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch TPOS products at skip=${skip}`);
  }
  
  const data = await response.json();
  return data.value || [];
}

/**
 * Sync TPOS Product IDs (biến thể) cho products trong kho
 * @param maxRecords - Số lượng records tối đa muốn lấy (mặc định 4000)
 */
export async function syncTPOSProductIds(
  maxRecords: number = 4000
): Promise<SyncTPOSProductIdsResult> {
  const result: SyncTPOSProductIdsResult = {
    matched: 0,
    notFound: 0,
    errors: 0,
    details: []
  };
  
  try {
    // 1. Lấy tất cả products từ Supabase (bỏ qua N/A và đã có productid_bienthe)
    const { supabase } = await import("@/integrations/supabase/client");
    
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, product_code, productid_bienthe")
      .neq("product_code", "N/A")
      .is("productid_bienthe", null) as any; // Use 'as any' temporarily until types regenerate
    
    if (productsError) throw productsError;
    
    if (!products || products.length === 0) {
      console.log("[TPOS Product Sync] No products to sync");
      return result;
    }
    
    console.log(`[TPOS Product Sync] Found ${products.length} products to sync`);
    
    // 2. Fetch TPOS products với phân trang
    const batches = Math.ceil(maxRecords / 1000);
    const tposProductMap = new Map<string, number>(); // DefaultCode -> Id
    
    for (let i = 0; i < batches; i++) {
      const skip = i * 1000;
      const tposProducts = await fetchTPOSProducts(skip);
      
      if (tposProducts.length === 0) break;
      
      tposProducts.forEach(p => {
        if (p.DefaultCode && p.Active) {
          tposProductMap.set(p.DefaultCode.trim(), p.Id);
        }
      });
      
      console.log(`[TPOS Product Sync] Batch ${i + 1}/${batches}: Fetched ${tposProducts.length} products`);
      
      // Delay để tránh rate limit
      if (i < batches - 1) {
        await randomDelay(300, 600);
      }
    }
    
    console.log(`[TPOS Product Sync] Total TPOS products in map: ${tposProductMap.size}`);
    
    // 3. Match và update
    for (const product of products) {
      const tposId = tposProductMap.get(product.product_code.trim());
      
      if (tposId) {
        try {
          const { error } = await (supabase
            .from("products")
            .update({ productid_bienthe: tposId } as any) // Use 'as any' temporarily
            .eq("id", product.id) as any);
          
          if (error) throw error;
          
          result.matched++;
          result.details.push({
            product_code: product.product_code,
            tpos_id: tposId
          });
          
          console.log(`✓ [${product.product_code}] -> TPOS ID: ${tposId}`);
        } catch (err) {
          result.errors++;
          result.details.push({
            product_code: product.product_code,
            error: err instanceof Error ? err.message : String(err)
          });
          
          console.error(`✗ [${product.product_code}] Error:`, err);
        }
      } else {
        result.notFound++;
        result.details.push({
          product_code: product.product_code
        });
        
        console.log(`⚠ [${product.product_code}] Not found in TPOS`);
      }
    }
    
    console.log("[TPOS Product Sync] Summary:", {
      matched: result.matched,
      notFound: result.notFound,
      errors: result.errors
    });
    
    return result;
    
  } catch (error) {
    console.error("[TPOS Product Sync] Error:", error);
    throw error;
  }
}

/**
 * Upload product details to TPOS Order
 * PUT request to update TPOS order with product details
 */
export async function uploadProductToTPOS(
  tposOrderId: string,
  products: Array<{
    product_code: string;
    product_name: string;
    sold_quantity: number;
    productid_bienthe?: number | null;
    selling_price?: number | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getActiveTPOSToken();
    if (!token) {
      return { success: false, error: "TPOS Bearer Token not found" };
    }
    
    // Fetch product details from Supabase to get productid_bienthe and selling_price
    const productCodes = products.map(p => p.product_code);
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("product_code, productid_bienthe, selling_price")
      .in("product_code", productCodes);
    
    if (productError) throw productError;
    
    // Create product map for quick lookup
    const productMap = new Map<string, {
      product_code: string;
      productid_bienthe: number | null;
      selling_price: number | null;
    }>(
      productData?.map(p => [p.product_code, {
        product_code: p.product_code,
        productid_bienthe: p.productid_bienthe,
        selling_price: p.selling_price
      }]) || []
    );
    
    // Build Details array for TPOS
    const details = products.map(p => {
      const dbProduct = productMap.get(p.product_code);
      return {
        ProductId: dbProduct?.productid_bienthe || null,
        ProductName: p.product_name,
        ProductNameGet: `[${p.product_code}] ${p.product_name}`,
        UOMId: 1,
        UOMName: "Cái",
        Quantity: p.sold_quantity,
        Price: dbProduct?.selling_price || 0,
        Factor: 1,
        ProductWeight: 0
      };
    });
    
    // PUT request to TPOS
    const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${tposOrderId})`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...getTPOSHeaders(token),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ Details: details })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TPOS API Error: ${response.status} - ${errorText}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error("[TPOS Upload] Error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface TPOSProductItem {
  id: string;
  product_code: string | null;
  base_product_code: string | null;
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
  variantsCreated?: number;
  variantsFailed?: number;
  variantErrors?: Array<{
    productName: string;
    productCode: string;
    errorMessage: string;
  }>;
  errors: Array<{
    productName: string;
    productCode: string;
    errorMessage: string;
    fullError: any;
  }>;
  imageUploadWarnings: Array<{
    productName: string;
    productCode: string;
    tposId: number;
    errorMessage: string;
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
    "Link Hình Ảnh": item.product_images?.[0] || undefined,
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

export interface TPOSUploadResponse {
  status?: string;
  message?: string;
  success_count?: number;
  failed_count?: number;
  errors?: Array<{
    row?: number;
    line?: number;
    product_code?: string;
    product_name?: string;
    field?: string;
    error?: string;
    message?: string;
    details?: any;
  }>;
  data?: any;
}

export async function uploadExcelToTPOS(excelBlob: Blob): Promise<TPOSUploadResponse> {
  const token = await getActiveTPOSToken();
  if (!token) {
    return {
      status: 'error',
      message: 'TPOS Bearer Token not found. Please configure in Settings.',
      success_count: 0,
      failed_count: 0,
      errors: [{
        error: 'Missing TPOS Bearer Token'
      }]
    };
  }
  
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
          headers: getTPOSHeaders(token),
          body: JSON.stringify(payload),
        });

        console.log("📥 [TPOS] Upload response status:", response.status);

        const responseText = await response.text();
        console.log("📥 [TPOS] Upload response body:", responseText);

        if (!response.ok) {
          // Parse error response từ TPOS
          let errorDetails = responseText;
          try {
            const errorJson = JSON.parse(responseText);
            errorDetails = JSON.stringify(errorJson, null, 2);
          } catch (e) {
            // Keep as is if not JSON
          }
          throw new Error(`Upload failed (${response.status}): ${errorDetails}`);
        }

        // Parse response để lấy thông tin chi tiết
        let parsedResponse: TPOSUploadResponse;
        try {
          parsedResponse = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
          parsedResponse = { message: responseText };
        }

        // Log chi tiết response
        console.log("✅ [TPOS] Excel uploaded, response:", JSON.stringify(parsedResponse, null, 2));
        
        // Kiểm tra nếu có lỗi trong response
        if (parsedResponse.errors && parsedResponse.errors.length > 0) {
          console.warn("⚠️ [TPOS] Upload có lỗi:", parsedResponse.errors);
        }

        resolve(parsedResponse);
      } catch (error) {
        console.error("❌ [TPOS] uploadExcelToTPOS error:", error);
        reject(error);
      }
    };

    reader.onerror = (error) => {
      console.error("❌ [TPOS] FileReader error:", error);
      reject(error);
    };
    
    reader.readAsDataURL(excelBlob);
  });
}

export async function getLatestProducts(count: number): Promise<any[]> {
  try {
    const token = await getActiveTPOSToken();
    if (!token) {
      throw new Error("TPOS Bearer Token not found");
    }
    
    console.log(`📥 [TPOS] Fetching latest ${count} products...`);
    
    await randomDelay(400, 900);

    const response = await fetch(`${TPOS_CONFIG.API_BASE}/ODataService.GetViewV2`, {
      method: "GET",
      headers: getTPOSHeaders(token),
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

    // Sort by ID ascending to match upload order
    return items.sort((a: any, b: any) => a.Id - b.Id).slice(0, count);
  } catch (error) {
    console.error("❌ getLatestProducts error:", error);
    throw error;
  }
}

export async function getProductDetail(productId: number): Promise<any> {
  const token = await getActiveTPOSToken();
  if (!token) {
    throw new Error("TPOS Bearer Token not found");
  }
  
  console.log(`🔎 [TPOS] Fetching product detail: ${productId}`);
  
  await randomDelay(200, 600);

  const expand = 'UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues),AttributeLines,UOMLines($expand=UOM),ComboProducts,ProductSupplierInfos';

  const response = await fetch(`${TPOS_CONFIG.API_BASE}(${productId})?$expand=${expand}`, {
    method: "GET",
    headers: getTPOSHeaders(token),
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

  const token = await getActiveTPOSToken();
  if (!token) {
    console.error('❌ [TPOS] Token not found');
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
        headers: getTPOSHeaders(token),
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
  const token = await getActiveTPOSToken();
  if (!token) {
    throw new Error("TPOS Bearer Token not found");
  }
  
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
    headers: getTPOSHeaders(token),
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
    imageUploadWarnings: [],
    productIds: [],
  };

  console.log(`🚀 Bắt đầu upload ${items.length} sản phẩm`);

  // ========================================
  // PRE-FETCH: Lấy base_product_code từ database
  // ========================================
  const productIds = items.map(item => item.id).filter(Boolean);
  const { data: productsData, error: fetchError } = await supabase
    .from('products')
    .select('id, base_product_code, product_code')
    .in('id', productIds);

  if (fetchError) {
    console.error('❌ Error fetching products:', fetchError);
    result.errors.push({
      productName: 'Fetch Error',
      productCode: 'N/A',
      errorMessage: fetchError.message,
      fullError: fetchError,
    });
    return result;
  }

  // Tạo Map để lookup nhanh: productId -> base_product_code
  const productMap = new Map(
    productsData?.map(p => [p.id, p.base_product_code || p.product_code]) || []
  );
  console.log(`📦 Loaded ${productMap.size} products with base_product_code`);

  // ========================================
  // PHASE 1: Check existing & Upload/Update products
  // ========================================
  const uploadedItems: Array<{
    item: TPOSProductItem;
    index: number;
    defaultCode: string;
    existingProductId?: number;
  }> = [];

  // Lấy token một lần
  const token = await getActiveTPOSToken();
  if (!token) {
    result.errors.push({
      productName: 'Token Error',
      productCode: 'N/A',
      errorMessage: 'TPOS Bearer Token not found',
      fullError: new Error('Token not found'),
    });
    return result;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const currentStep = i + 1;
    
    // Lấy defaultCode từ productMap (base_product_code từ DB)
    const defaultCode = productMap.get(item.id) || item.product_code || '';
    
    onProgress?.(currentStep, items.length * 2, `[1/2] Đang xử lý ${item.product_name}...`);

    try {
      // ===== CHECK: Tìm product đã tồn tại trên TPOS với DefaultCode này =====
      console.log(`🔍 [${currentStep}/${items.length}] Checking if "${defaultCode}" exists on TPOS...`);
      await randomDelay(200, 400);
      
      const searchResponse = await fetch(
        `${TPOS_CONFIG.API_BASE}/ODataService.GetViewV2?$filter=DefaultCode eq '${defaultCode}'&$select=Id,DefaultCode,Name&$top=1`,
        { headers: getTPOSHeaders(token) }
      );

      let existingProductId: number | undefined;
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const existingProduct = searchData.value?.[0];
        
        if (existingProduct) {
          existingProductId = existingProduct.Id;
          console.log(`✓ Found existing product: Id=${existingProductId}, DefaultCode="${existingProduct.DefaultCode}"`);
          
          // ===== UPDATE: Sử dụng PUT API =====
          console.log(`📝 [${currentStep}/${items.length}] Updating product ${existingProductId} with DefaultCode="${defaultCode}"`);
          
          const updatePayload = {
            Id: existingProductId,
            Name: item.product_name,
            ListPrice: item.selling_price || 0,
            StandardPrice: item.unit_price || 0,
            Description: item.variant || null,
          };
          
          const updateResponse = await fetch(
            `${TPOS_CONFIG.API_BASE}/ODataService.UpdateV2`,
            {
              method: 'POST',
              headers: getTPOSHeaders(token),
              body: JSON.stringify(updatePayload),
            }
          );
          
          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`UPDATE failed: ${updateResponse.status} - ${errorText}`);
          }
          
          console.log(`✅ [${currentStep}/${items.length}] Updated product ${existingProductId}: ${item.product_name}`);
        }
      }
      
      // ===== CREATE: Nếu chưa tồn tại, upload Excel =====
      if (!existingProductId) {
        console.log(`📝 [${currentStep}/${items.length}] Creating new product with DefaultCode="${defaultCode}"`);
        
        const excelDataForTPOS = [{
          "Loại sản phẩm": TPOS_CONFIG.DEFAULT_PRODUCT_TYPE,
          "Mã sản phẩm": defaultCode.toString() || undefined,
          "Mã chốt đơn": undefined,
          "Tên sản phẩm": item.product_name?.toString() || undefined,
          "Giá bán": item.selling_price || 0,
          "Giá mua": item.unit_price || 0,
          "Đơn vị": TPOS_CONFIG.DEFAULT_UOM,
          "Nhóm sản phẩm": TPOS_CONFIG.DEFAULT_CATEGORY,
          "Mã vạch": defaultCode.toString() || undefined,
          "Khối lượng": undefined,
          "Chiết khấu bán": undefined,
          "Chiết khấu mua": undefined,
          "Tồn kho": undefined,
          "Giá vốn": undefined,
          "Ghi chú": item.variant || undefined,
          "Cho phép bán ở công ty khác": "FALSE",
          "Thuộc tính": undefined,
        }];

        const worksheet = XLSX.utils.json_to_sheet(excelDataForTPOS);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Đặt Hàng");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const excelBlob = new Blob([excelBuffer], { 
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
        });
        
        // Upload Excel
        const uploadResult = await uploadExcelToTPOS(excelBlob);
        
        if (uploadResult.errors && uploadResult.errors.length > 0) {
          const errorMsg = uploadResult.errors.map(e => e.error || e.message).join(', ');
          throw new Error(`Upload Excel thất bại: ${errorMsg}`);
        }

        console.log(`✅ [${currentStep}/${items.length}] Created new product: ${item.product_name}`);
      }
      
      uploadedItems.push({ item, index: i, defaultCode, existingProductId });
      result.successCount++;
      
      // Delay giữa các upload
      if (i < items.length - 1) {
        await randomDelay(800, 1200);
      }

    } catch (error) {
      console.error(`❌ [${currentStep}/${items.length}] Failed to process ${item.product_name}:`, error);
      result.failedCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({
        productName: item.product_name,
        productCode: item.product_code || 'N/A',
        errorMessage: errorMessage,
        fullError: error,
      });
    }
  }

  // ========================================
  // PHASE 2: Xử lý matching cho CREATE cases
  // ========================================
  if (uploadedItems.length === 0) {
    console.log("❌ Không có sản phẩm nào xử lý thành công");
    return result;
  }

  // Đếm số products được CREATE (không có existingProductId)
  const createdItems = uploadedItems.filter(ui => !ui.existingProductId);
  const updatedItems = uploadedItems.filter(ui => ui.existingProductId);
  
  console.log(`\n📊 Summary: ${updatedItems.length} updated, ${createdItems.length} created`);

  // ========================================
  // PHASE 3: Match products MỚI TẠO với TPOS
  // ========================================
  let tposProductMap = new Map<string, any>();
  
  if (createdItems.length > 0) {
    console.log(`\n🔍 Đang lấy ${createdItems.length} sản phẩm mới tạo từ TPOS...`);
    onProgress?.(
      items.length, 
      items.length * 2, 
      `[2/2] Đang lấy danh sách sản phẩm từ TPOS...`
    );

    try {
      // Tăng delay để TPOS có thời gian xử lý
      console.log("⏳ Đang chờ TPOS xử lý...");
      await randomDelay(3000, 5000);
      
      // GET products của "Tú", sort by Id DESC (mới nhất lên đầu)
      const listResponse = await fetch(
        `${TPOS_CONFIG.API_BASE}/ODataService.GetViewV2?$orderby=Id desc&$top=100`,
        { headers: getTPOSHeaders(token) }
      );
      
      if (!listResponse.ok) {
        throw new Error("Không thể lấy danh sách sản phẩm từ TPOS");
      }

      const listData = await listResponse.json();
      
      // Filter products của "Tú" và lấy mới nhất
      const allUserProducts = (listData.value || listData)
        .filter((p: any) => p.CreatedByName === TPOS_CONFIG.CREATED_BY_NAME);
      
      if (allUserProducts.length === 0) {
        throw new Error(`Không tìm thấy sản phẩm của "${TPOS_CONFIG.CREATED_BY_NAME}" trên TPOS`);
      }

      // Lấy N products mới nhất (theo số lượng created)
      const latestNProducts = allUserProducts.slice(0, createdItems.length);
      
      console.log(`✅ Found ${latestNProducts.length} products mới nhất`);
      console.log(`   Product IDs: ${latestNProducts.map((p: any) => p.Id).join(', ')}`);
      console.log(`   DefaultCodes: ${latestNProducts.map((p: any) => p.DefaultCode).join(', ')}`);

      // Tạo map cho matching
      latestNProducts.forEach((p: any) => {
        if (p.DefaultCode) {
          tposProductMap.set(p.DefaultCode.trim(), p);
        }
      });

      console.log(`\n🔗 Match rule: DefaultCode (TPOS) === base_product_code (DB)`);
      
    } catch (error) {
      console.error("❌ Error fetching TPOS products:", error);
      result.errors.push({
        productName: 'Fetch Error',
        productCode: 'N/A',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        fullError: error,
      });
      return result;
    }
  }

  // ========================================
  // PHASE 4: Process ALL items (updated + created)
  // ========================================
  console.log(`\n🔗 Đang xử lý ${uploadedItems.length} products...`);
  
  for (const { item, index, defaultCode, existingProductId } of uploadedItems) {
    const currentStep = index + 1 + items.length;
    
    if (!defaultCode) {
      console.warn(`⚠️ [${currentStep}/${items.length * 2}] ${item.product_name} không có defaultCode`);
      continue;
    }

    let tposProductId: number;
    
    // Case 1: Product đã UPDATE → dùng existingProductId
    if (existingProductId) {
      tposProductId = existingProductId;
      console.log(`✅ [${currentStep}/${items.length * 2}] UPDATED product:`);
      console.log(`   DefaultCode="${defaultCode}" | TPOS Id=${tposProductId}`);
    } 
    // Case 2: Product mới CREATE → cần match
    else {
      const tposProduct = tposProductMap.get(defaultCode.trim());
      
      if (!tposProduct) {
        console.warn(`⚠️ [${currentStep}/${items.length * 2}] DefaultCode "${defaultCode}" không tìm thấy`);
        result.errors.push({
          productName: item.product_name,
          productCode: defaultCode,
          errorMessage: `DefaultCode không tìm thấy trong products mới tạo`,
          fullError: null,
        });
        continue;
      }

      tposProductId = tposProduct.Id;
      console.log(`✅ [${currentStep}/${items.length * 2}] CREATED & MATCHED:`);
      console.log(`   DefaultCode="${defaultCode}" | TPOS Id=${tposProductId}`);
    }
    
    onProgress?.(
      currentStep, 
      items.length * 2, 
      `[2/2] Đang xử lý ${item.product_name}...`
    );

    // Lưu mapping: itemId → tpos_product_id
    result.productIds.push({
      itemId: item.id,
      tposId: tposProductId,
    });

    // Lưu vào cache
    const cache = getCachedTPOSIds();
    cache.set(defaultCode, tposProductId);
    saveCachedTPOSIds(cache);

    // ========================================
    // PHASE 5: Upload image nếu có
    // ========================================
    if (item.product_images?.[0]) {
      try {
        console.log(`📸 [${currentStep}/${items.length * 2}] Uploading image for ${item.product_name}...`);
        
        const expandParams = "Images,ProductVariants($select=Id,Name)";
        const detailResponse = await fetch(
          `${TPOS_CONFIG.API_BASE}(${tposProductId})?$expand=${encodeURIComponent(expandParams)}`,
          { headers: getTPOSHeaders(token) }
        );

        if (!detailResponse.ok) {
          throw new Error("Không lấy được chi tiết sản phẩm");
        }

        let productDetail = await detailResponse.json();
        const base64Image = await imageUrlToBase64(item.product_images[0]);
        
        if (base64Image) {
          productDetail.Image = base64Image;
          delete productDetail["@odata.context"];
          
          const updateResponse = await fetch(
            `${TPOS_CONFIG.API_BASE}/ODataService.UpdateV2`,
            {
              method: "POST",
              headers: getTPOSHeaders(token),
              body: JSON.stringify(productDetail)
            }
          );

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.warn(`⚠️ Upload ảnh thất bại cho ${item.product_name}: ${errorText}`);
            result.imageUploadWarnings.push({
              productName: item.product_name,
              productCode: item.product_code,
              tposId: tposProductId,
              errorMessage: errorText
            });
          } else {
            console.log(`✅ Image uploaded for ${item.product_name}`);
          }
        }
        
        await randomDelay(500, 800);
      } catch (error) {
        console.error(`❌ Error uploading image for ${item.product_name}:`, error);
        result.imageUploadWarnings.push({
          productName: item.product_name,
          productCode: item.product_code || 'N/A',
          tposId: tposProductId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  console.log(`\n✅ Upload hoàn tất!`);
  console.log(`   Success: ${result.successCount}/${items.length}`);
  console.log(`   Failed: ${result.failedCount}/${items.length}`);
  result.success = result.successCount > 0;
  result.savedIds = result.productIds.length;

  return result;
}
