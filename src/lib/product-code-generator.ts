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
