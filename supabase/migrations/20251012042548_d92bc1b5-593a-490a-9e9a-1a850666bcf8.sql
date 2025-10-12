-- Enable unaccent extension for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create a function to search products without accents
CREATE OR REPLACE FUNCTION search_products_unaccent(search_text TEXT)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products
  WHERE 
    unaccent(product_code) ILIKE unaccent('%' || search_text || '%')
    OR unaccent(product_name) ILIKE unaccent('%' || search_text || '%')
    OR unaccent(COALESCE(barcode, '')) ILIKE unaccent('%' || search_text || '%')
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;