// Variant attributes for product selection
// Mapping với TPOS Attribute IDs
export const TPOS_ATTRIBUTE_IDS = {
  SIZE_TEXT: 1,
  COLOR: 3,
  SIZE_NUMBER: 4
} as const;

export const TPOS_COLOR_MAP: Record<string, number> = {};

export const TPOS_SIZE_TEXT_MAP: Record<string, number> = {};

export const TPOS_SIZE_NUMBER_MAP: Record<string, number> = {};

export const COLORS: readonly string[] = [];

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

export const TEXT_SIZES: readonly string[] = [];

export const NUMBER_SIZES: readonly string[] = [];
