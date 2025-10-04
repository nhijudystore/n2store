-- Phase 2: Fix RLS Policies for Authenticated Users Only

-- Drop all overly permissive policies (those using "true" conditions)
DROP POLICY IF EXISTS "Allow all operations on goods_receiving" ON goods_receiving;
DROP POLICY IF EXISTS "Allow all operations on goods_receiving_items" ON goods_receiving_items;
DROP POLICY IF EXISTS "Allow all operations on live_orders" ON live_orders;
DROP POLICY IF EXISTS "Allow all operations on live_phases" ON live_phases;
DROP POLICY IF EXISTS "Allow all operations on live_products" ON live_products;
DROP POLICY IF EXISTS "Allow all operations on live_sessions" ON live_sessions;
DROP POLICY IF EXISTS "Allow all operations on livestream_reports" ON livestream_reports;
DROP POLICY IF EXISTS "Allow all operations on products" ON products;
DROP POLICY IF EXISTS "Allow all operations on purchase_order_items" ON purchase_order_items;
DROP POLICY IF EXISTS "Allow all operations on purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Allow all operations on suppliers" ON suppliers;

-- Create authenticated-only policies for all business tables

-- Purchase Orders
CREATE POLICY "authenticated_select_purchase_orders" ON purchase_orders 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_purchase_orders" ON purchase_orders 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_purchase_orders" ON purchase_orders 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_purchase_orders" ON purchase_orders 
FOR DELETE USING (auth.role() = 'authenticated');

-- Purchase Order Items
CREATE POLICY "authenticated_select_purchase_order_items" ON purchase_order_items 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_purchase_order_items" ON purchase_order_items 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_purchase_order_items" ON purchase_order_items 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_purchase_order_items" ON purchase_order_items 
FOR DELETE USING (auth.role() = 'authenticated');

-- Suppliers
CREATE POLICY "authenticated_select_suppliers" ON suppliers 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_suppliers" ON suppliers 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_suppliers" ON suppliers 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_suppliers" ON suppliers 
FOR DELETE USING (auth.role() = 'authenticated');

-- Products
CREATE POLICY "authenticated_select_products" ON products 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_products" ON products 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_products" ON products 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_products" ON products 
FOR DELETE USING (auth.role() = 'authenticated');

-- Goods Receiving
CREATE POLICY "authenticated_select_goods_receiving" ON goods_receiving 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_goods_receiving" ON goods_receiving 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_goods_receiving" ON goods_receiving 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_goods_receiving" ON goods_receiving 
FOR DELETE USING (auth.role() = 'authenticated');

-- Goods Receiving Items
CREATE POLICY "authenticated_select_goods_receiving_items" ON goods_receiving_items 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_goods_receiving_items" ON goods_receiving_items 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_goods_receiving_items" ON goods_receiving_items 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_goods_receiving_items" ON goods_receiving_items 
FOR DELETE USING (auth.role() = 'authenticated');

-- Live Sessions
CREATE POLICY "authenticated_select_live_sessions" ON live_sessions 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_live_sessions" ON live_sessions 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_live_sessions" ON live_sessions 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_live_sessions" ON live_sessions 
FOR DELETE USING (auth.role() = 'authenticated');

-- Live Products
CREATE POLICY "authenticated_select_live_products" ON live_products 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_live_products" ON live_products 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_live_products" ON live_products 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_live_products" ON live_products 
FOR DELETE USING (auth.role() = 'authenticated');

-- Live Orders
CREATE POLICY "authenticated_select_live_orders" ON live_orders 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_live_orders" ON live_orders 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_live_orders" ON live_orders 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_live_orders" ON live_orders 
FOR DELETE USING (auth.role() = 'authenticated');

-- Live Phases
CREATE POLICY "authenticated_select_live_phases" ON live_phases 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_live_phases" ON live_phases 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_live_phases" ON live_phases 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_live_phases" ON live_phases 
FOR DELETE USING (auth.role() = 'authenticated');

-- Livestream Reports
CREATE POLICY "authenticated_select_livestream_reports" ON livestream_reports 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_livestream_reports" ON livestream_reports 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_livestream_reports" ON livestream_reports 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_livestream_reports" ON livestream_reports 
FOR DELETE USING (auth.role() = 'authenticated');