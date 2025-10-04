import { supabase } from "@/integrations/supabase/client";
import { convertVietnameseToUpperCase } from "./utils";

// Keywords for product categories
const CATEGORY_N_KEYWORDS = ["QUAN", "AO", "DAM", "SET", "JUM", "AOKHOAC"];
const CATEGORY_P_KEYWORDS = ["TUI", "MATKINH", "MYPHAM", "BANGDO", "GIAYDEP", "PHUKIEN"];

/**
 * Detect product category based on product name
 * @param productName - Product name to analyze
 * @returns 'N' for clothing, 'P' for accessories
 */
export function detectProductCategory(productName: string): 'N' | 'P' {
  const normalized = convertVietnameseToUpperCase(productName);
  
  // Check for Category N keywords first (priority)
  const hasNKeyword = CATEGORY_N_KEYWORDS.some(keyword => normalized.includes(keyword));
  
  if (hasNKeyword) {
    return 'N';
  }
  
  // Check for Category P keywords
  const hasPKeyword = CATEGORY_P_KEYWORDS.some(keyword => normalized.includes(keyword));
  
  if (hasPKeyword) {
    return 'P';
  }
  
  // Default to N if no keywords found
  return 'N';
}

/**
 * Get the next available product code for a category
 * @param category - 'N' or 'P'
 * @returns Next product code (e.g., 'N126' or 'P45')
 */
export async function getNextProductCode(category: 'N' | 'P'): Promise<string> {
  try {
    // Query for the highest code in this category
    const { data, error } = await supabase
      .from("products")
      .select("product_code")
      .like("product_code", `${category}%`)
      .order("product_code", { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      // No existing codes, start with 1
      return `${category}1`;
    }
    
    // Extract number from the code
    const lastCode = data[0].product_code;
    const numberMatch = lastCode.match(/\d+$/);
    
    if (!numberMatch) {
      // Invalid format, start with 1
      return `${category}1`;
    }
    
    const lastNumber = parseInt(numberMatch[0], 10);
    const nextNumber = lastNumber + 1;
    
    return `${category}${nextNumber}`;
  } catch (error) {
    console.error("Error getting next product code:", error);
    // Fallback to default
    return `${category}1`;
  }
}

/**
 * Increment product code by 1
 * @param productCode - Current product code (e.g., 'N123' or 'P45')
 * @param existingCodes - Array of existing codes to avoid duplicates
 * @returns Incremented code (e.g., 'N124' or 'P46') or null if invalid
 */
export function incrementProductCode(
  productCode: string, 
  existingCodes: string[] = []
): string | null {
  if (!productCode.trim()) return null;
  
  // Extract prefix and number
  const match = productCode.match(/^([NP])(\d+)$/);
  if (!match) return null; // Invalid format
  
  const prefix = match[1];
  let number = parseInt(match[2], 10);
  
  // Increment and check for duplicates
  let newCode: string;
  do {
    number++;
    newCode = `${prefix}${number}`;
  } while (existingCodes.includes(newCode));
  
  return newCode;
}

/**
 * Generate product code based on product name
 * @param productName - Product name to generate code from
 * @returns Generated product code (e.g., 'N126' or 'P45')
 */
export async function generateProductCode(productName: string): Promise<string> {
  if (!productName.trim()) {
    throw new Error("Tên sản phẩm không được để trống");
  }
  
  const category = detectProductCategory(productName);
  const code = await getNextProductCode(category);
  
  return code;
}
