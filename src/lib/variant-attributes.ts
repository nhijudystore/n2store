// Variant attributes for product selection

export const COLORS = [
  "Trắng",
  "Trắng Hồng",
  "Trắng Kem",
  "Trắng Sáng",
  "Đen",
  "Den",
  "Đen Bạc",
  "Đen Vàng",
  "Xám",
  "Xám đậm",
  "Xám nhạt",
  "Xám Chuột",
  "Xám Đen",
  "Xám Khói",
  "Xám Trắng",
  "Ghi",
  "Đỏ",
  "Đỏ đậm",
  "Đỏ tươi",
  "Đỏ Đỏ",
  "Đỏ bordo",
  "Đỏ burgundy",
  "Cam",
  "Cam đậm",
  "Cam Đào",
  "Cam Lanh",
  "Cam Sữa",
  "Cam coral",
  "Cam đất",
  "Vàng",
  "Vàng nhạt",
  "Vàng chanh",
  "Vàng gold",
  "Vàng Đồng",
  "Vàng pastel",
  "Xanh lá",
  "Xanh lá đậm",
  "Xanh lá nhạt",
  "Xanh lá cây",
  "Xanh dương",
  "Xanh dương đậm",
  "Xanh dương nhạt",
  "Xanh navy",
  "Xanh da trời",
  "Xanh biển",
  "Xanh ngọc",
  "Xanh rêu",
  "Xanh olive",
  "Xanh mint",
  "Xanh pastel",
  "Xanh baby",
  "Xanh petrol",
  "Xanh teal",
  "Xanh coban",
  "Xanh indigo",
  "Xanh Bơ",
  "Xanh Đậu",
  "Xanh Đen",
  "Xanh Ma",
  "Tím",
  "Tím đậm",
  "Tím nhạt",
  "Tím pastel",
  "Tím Môn",
  "Hồng",
  "Hồng đậm",
  "Hồng nhạt",
  "Hồng phấn",
  "Hồng pastel",
  "Hồng baby",
  "Hồng Đào",
  "Hồng Đất",
  "Hồng Dâu",
  "Hồng Rước",
  "Nâu",
  "Nâu đậm",
  "Nâu nhạt",
  "Nâu đỏ",
  "Nâu cafe",
  "Nâu chocolate",
  "Be",
  "Kem",
  "Bạc",
  "Bò",
  "Cà Phê",
  "Caro",
  "Cỏ Vít",
  "Đậm",
  "Nhạt",
  "Nude",
  "Sọc Đen",
  "Sọc Hồng",
  "Sọc Trắng",
  "Sọc Xám",
  "Sọc Xanh",
  "Jean Trắng",
  "Jean Xanh",
  "Muối Tiêu",
  "Trong",
  "Nhiều màu"
] as const;

export type VariantType = 'color' | 'text-size' | 'number-size' | 'unknown';

/**
 * Determine the type of variant (color, text size, number size, or unknown)
 */
export function getVariantType(variant: string): VariantType {
  if (COLORS.includes(variant as any)) {
    return 'color';
  }
  if (TEXT_SIZES.includes(variant as any)) {
    return 'text-size';
  }
  if (NUMBER_SIZES.includes(variant as any)) {
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

export const TEXT_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL"
] as const;

export const NUMBER_SIZES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48"
] as const;
