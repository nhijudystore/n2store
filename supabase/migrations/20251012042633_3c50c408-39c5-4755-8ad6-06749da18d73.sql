-- Fix search_path security warning for search_products_unaccent
DROP FUNCTION IF EXISTS search_products_unaccent(TEXT);

CREATE OR REPLACE FUNCTION search_products_unaccent(search_text TEXT)
RETURNS SETOF products 
LANGUAGE plpgsql 
STABLE
SET search_path TO public
AS $$
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
$$;