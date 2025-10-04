// =====================================================
// TPOS API CONFIGURATION
// =====================================================

export const TPOS_CONFIG = {
  API_BASE: "https://tomato.tpos.vn/odata/ProductTemplate",
  
  // Upload settings
  CONCURRENT_UPLOADS: 3,
  CREATED_BY_NAME: "Tú",
  
  // Product settings
  DEFAULT_CATEGORY: "QUẦN ÁO",
  DEFAULT_UOM: "CÁI",
  DEFAULT_PRODUCT_TYPE: "Có thể lưu trữ",
  
  // API version
  API_VERSION: "2701",
} as const;

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function generateRandomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function randomDelay(min = 500, max = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export function cleanBase64(base64String: string | null | undefined): string | null {
  if (!base64String) return null;
  if (base64String.includes(",")) {
    base64String = base64String.split(",")[1];
  }
  return base64String.replace(/\s/g, "");
}

// TPOS API calls now go through the edge function proxy
// No headers needed in client-side code
