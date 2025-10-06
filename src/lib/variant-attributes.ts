// Variant attributes for product selection
// Mapping với TPOS Attribute IDs
export const TPOS_ATTRIBUTE_IDS = {
  SIZE_TEXT: 1,
  COLOR: 3,
  SIZE_NUMBER: 4
} as const;

// Map variant name to TPOS attribute value ID
export const TPOS_SIZE_TEXT_MAP: Record<string, { Id: number; Code: string; Sequence: number | null }> = {
  "Free Size": { Id: 5, Code: "FS", Sequence: 0 },
  "S": { Id: 1, Code: "S", Sequence: 1 },
  "M": { Id: 2, Code: "M", Sequence: 2 },
  "L": { Id: 3, Code: "L", Sequence: 3 },
  "XL": { Id: 4, Code: "XL", Sequence: 4 },
  "XXL": { Id: 31, Code: "xxl", Sequence: null },
  "XXXL": { Id: 32, Code: "xxxl", Sequence: null }
};

export const TPOS_SIZE_NUMBER_MAP: Record<string, { Id: number; Code: string }> = {
  "27": { Id: 80, Code: "27" },
  "28": { Id: 81, Code: "28" },
  "29": { Id: 18, Code: "29" },
  "30": { Id: 19, Code: "30" },
  "31": { Id: 20, Code: "31" },
  "32": { Id: 21, Code: "32" },
  "33": { Id: 22, Code: "33" },
  "34": { Id: 23, Code: "34" },
  "35": { Id: 24, Code: "35" },
  "36": { Id: 25, Code: "36" },
  "37": { Id: 26, Code: "37" },
  "38": { Id: 27, Code: "38" },
  "39": { Id: 28, Code: "39" },
  "40": { Id: 29, Code: "40" },
  "41": { Id: 9, Code: "41" },
  "42": { Id: 10, Code: "42" },
  "43": { Id: 11, Code: "43" },
  "44": { Id: 12, Code: "44" }
};

export const TPOS_COLOR_MAP: Record<string, { Id: number; Code: string }> = {
  "Trắng": { Id: 6, Code: "trang" },
  "Đen": { Id: 7, Code: "den" },
  "Đỏ": { Id: 8, Code: "do" },
  "Xanh": { Id: 9, Code: "xanh" },
  "Vàng": { Id: 10, Code: "vang" },
  "Hồng": { Id: 11, Code: "hong" },
  "Xám": { Id: 12, Code: "xam" },
  "Nâu": { Id: 13, Code: "nau" },
  "Cam": { Id: 14, Code: "cam" },
  "Tím": { Id: 15, Code: "tim" }
};

export const COLORS: readonly string[] = Object.keys(TPOS_COLOR_MAP);
export const TEXT_SIZES: readonly string[] = Object.keys(TPOS_SIZE_TEXT_MAP);
export const NUMBER_SIZES: readonly string[] = Object.keys(TPOS_SIZE_NUMBER_MAP);

export type VariantType = 'color' | 'text-size' | 'number-size' | 'unknown';

/**
 * Determine the type of variant (color, text size, number size, or unknown)
 */
export function getVariantType(variant: string): VariantType {
  if (COLORS.includes(variant)) {
    return 'color';
  }
  if (TEXT_SIZES.includes(variant)) {
    return 'text-size';
  }
  if (NUMBER_SIZES.includes(variant)) {
    return 'number-size';
  }
  return 'unknown';
}

/**
 * Generate color code with duplicate handling
 * Single word: first letter (D for Đỏ)
 * Multiple words: first letter of each word (DD for Đỏ Đỏ, DB for Đen Bạc)
 * Duplicates: add number suffix (D1, D2, etc.)
 */
export function generateColorCode(color: string, usedCodes: Set<string>): string {
  const words = color.trim().split(/\s+/);
  
  let code = '';
  if (words.length === 1) {
    // Single word: take first letter
    code = words[0].charAt(0);
  } else {
    // Multiple words: take first letter of each word
    code = words.map(word => word.charAt(0)).join('');
  }
  
  // Convert to uppercase without Vietnamese diacritics
  code = code.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'D')
    .replace(/Đ/g, 'D');
  
  // Handle duplicates by adding number suffix
  let finalCode = code;
  let counter = 1;
  while (usedCodes.has(finalCode)) {
    finalCode = `${code}${counter}`;
    counter++;
  }
  
  usedCodes.add(finalCode);
  return finalCode;
}

/**
 * Generate variant code based on variant type
 */
export function generateVariantCode(variant: string, usedCodes: Set<string>): string {
  const type = getVariantType(variant);
  
  switch (type) {
    case 'color':
      return generateColorCode(variant, usedCodes);
    
    case 'text-size':
      // Return size name as-is (e.g., "M" -> "M")
      return variant;
    
    case 'number-size':
      // Return "A" + size name (e.g., "40" -> "A40")
      return `A${variant}`;
    
    case 'unknown':
      // Fallback to old logic
      return variant.toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'D')
        .replace(/Đ/g, 'D')
        .replace(/\s+/g, '');
  }
}

/**
 * Generate product name with variant
 */
export function generateProductNameWithVariant(productName: string, variant: string): string {
  const type = getVariantType(variant);
  
  if (type === 'color') {
    return `${productName} ${variant}`;
  } else {
    // For sizes (both text and number)
    return `${productName} size ${variant}`;
  }
}
