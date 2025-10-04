// Variant attributes for product selection
// Mapping với TPOS Attribute IDs
export const TPOS_ATTRIBUTE_IDS = {
  SIZE_TEXT: 1,
  COLOR: 3,
  SIZE_NUMBER: 4
} as const;

export const TPOS_COLOR_MAP: Record<string, number> = {
  "Trắng": 6,
  "Đen": 7,
  "Đỏ": 8,
  "Vàng": 9,
  "Cam": 10,
  "Xám": 11,
  "Hồng": 12,
  "Nude": 14,
  "Nâu": 15,
  "Rêu": 16,
  "Xanh": 17,
  "Bạc": 25,
  "Tím": 26,
  "Xanh Min": 27,
  "Trắng Kem": 28,
  "Xanh Lá": 29,
  "Cổ Vịt": 38,
  "Xanh Đậu": 40,
  "Tím Mộn": 42,
  "Muối Tiêu": 43,
  "Kem": 45,
  "Hồng Đậm": 47,
  "Ghi": 49,
  "Xanh Mạ": 50,
  "Vàng Đồng": 51,
  "Xanh Bơ": 52,
  "Xanh Đen": 53,
  "Xanh CoBan": 54,
  "Xám Đậm": 55,
  "Xám Nhạt": 56,
  "Xanh Dương": 57,
  "Cam Sữa": 58,
  "Hồng Nhạt": 59,
  "Đậm": 60,
  "Nhạt": 61,
  "Xám Khói": 62,
  "Xám Chuột": 63,
  "Xám Đen": 64,
  "Xám Trắng": 65,
  "Xanh Đậm": 66,
  "Sọc Đen": 67,
  "Sọc Trắng": 68,
  "Sọc Xám": 69,
  "Jean Trắng": 70,
  "Jean Xanh": 71,
  "Cam Đất": 72,
  "Nâu Đậm": 73,
  "Nâu Nhạt": 74,
  "Đỏ Tươi": 75,
  "Đen Vàng": 76,
  "Cà Phê": 77,
  "Đen Bạc": 78,
  "Bò": 79,
  "Sọc Xanh": 82,
  "Xanh Rêu": 83,
  "Hồng Ruốc": 84,
  "Hồng Dâu": 85,
  "Xanh Nhạt": 86,
  "Xanh Ngọc": 87,
  "Caro": 88,
  "Sọc Hồng": 89,
  "Trong": 90,
  "Trắng Hồng": 95,
  "Trắng Sáng": 96,
  "Đỏ Đô": 97,
  "Cam Đào": 98,
  "Cam Lạnh": 99,
  "Hồng Đào": 100,
  "Hồng Đất": 101,
  "Tím Đậm": 102
};

export const TPOS_SIZE_TEXT_MAP: Record<string, number> = {
  "Free Size": 5,
  "S": 1,
  "M": 2,
  "L": 3,
  "XL": 4,
  "XXL": 31,
  "XXXL": 32
};

export const TPOS_SIZE_NUMBER_MAP: Record<string, number> = {
  "1": 22,
  "2": 23,
  "3": 24,
  "4": 48,
  "27": 80,
  "28": 81,
  "29": 18,
  "30": 19,
  "31": 20,
  "32": 21,
  "34": 46,
  "35": 33,
  "36": 34,
  "37": 35,
  "38": 36,
  "39": 37,
  "40": 44,
  "41": 91,
  "42": 92,
  "43": 93,
  "44": 94
};

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
