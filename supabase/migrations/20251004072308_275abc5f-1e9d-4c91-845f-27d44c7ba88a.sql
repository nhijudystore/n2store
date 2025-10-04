-- Phase 2: Fix RLS Policies - Only create policies that don't exist

-- Create authenticated-only policies (only if they don't exist)

-- Purchase Orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'authenticated_select_purchase_orders') THEN
    CREATE POLICY "authenticated_select_purchase_orders" ON purchase_orders FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'authenticated_insert_purchase_orders') THEN
    CREATE POLICY "authenticated_insert_purchase_orders" ON purchase_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'authenticated_update_purchase_orders') THEN
    CREATE POLICY "authenticated_update_purchase_orders" ON purchase_orders FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'authenticated_delete_purchase_orders') THEN
    CREATE POLICY "authenticated_delete_purchase_orders" ON purchase_orders FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Purchase Order Items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'authenticated_select_purchase_order_items') THEN
    CREATE POLICY "authenticated_select_purchase_order_items" ON purchase_order_items FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'authenticated_insert_purchase_order_items') THEN
    CREATE POLICY "authenticated_insert_purchase_order_items" ON purchase_order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'authenticated_update_purchase_order_items') THEN
    CREATE POLICY "authenticated_update_purchase_order_items" ON purchase_order_items FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'authenticated_delete_purchase_order_items') THEN
    CREATE POLICY "authenticated_delete_purchase_order_items" ON purchase_order_items FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Suppliers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'authenticated_select_suppliers') THEN
    CREATE POLICY "authenticated_select_suppliers" ON suppliers FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'authenticated_insert_suppliers') THEN
    CREATE POLICY "authenticated_insert_suppliers" ON suppliers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'authenticated_update_suppliers') THEN
    CREATE POLICY "authenticated_update_suppliers" ON suppliers FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'authenticated_delete_suppliers') THEN
    CREATE POLICY "authenticated_delete_suppliers" ON suppliers FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Products
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'authenticated_select_products') THEN
    CREATE POLICY "authenticated_select_products" ON products FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'authenticated_insert_products') THEN
    CREATE POLICY "authenticated_insert_products" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'authenticated_update_products') THEN
    CREATE POLICY "authenticated_update_products" ON products FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'authenticated_delete_products') THEN
    CREATE POLICY "authenticated_delete_products" ON products FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Goods Receiving
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receiving' AND policyname = 'authenticated_select_goods_receiving') THEN
    CREATE POLICY "authenticated_select_goods_receiving" ON goods_receiving FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receiving' AND policyname = 'authenticated_insert_goods_receiving') THEN
    CREATE POLICY "authenticated_insert_goods_receiving" ON goods_receiving FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receiving' AND policyname = 'authenticated_update_goods_receiving') THEN
    CREATE POLICY "authenticated_update_goods_receiving" ON goods_receiving FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receiving' AND policyname = 'authenticated_delete_goods_receiving') THEN
    CREATE POLICY "authenticated_delete_goods_receiving" ON goods_receiving FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Goods Receiving Items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receiving_items' AND policyname = 'authenticated_select_goods_receiving_items') THEN
    CREATE POLICY "authenticated_select_goods_receiving_items" ON goods_receiving_items FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receiving_items' AND policyname = 'authenticated_insert_goods_receiving_items') THEN
    CREATE POLICY "authenticated_insert_goods_receiving_items" ON goods_receiving_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receiving_items' AND policyname = 'authenticated_update_goods_receiving_items') THEN
    CREATE POLICY "authenticated_update_goods_receiving_items" ON goods_receiving_items FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goods_receiving_items' AND policyname = 'authenticated_delete_goods_receiving_items') THEN
    CREATE POLICY "authenticated_delete_goods_receiving_items" ON goods_receiving_items FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Live Sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'authenticated_select_live_sessions') THEN
    CREATE POLICY "authenticated_select_live_sessions" ON live_sessions FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'authenticated_insert_live_sessions') THEN
    CREATE POLICY "authenticated_insert_live_sessions" ON live_sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'authenticated_update_live_sessions') THEN
    CREATE POLICY "authenticated_update_live_sessions" ON live_sessions FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'authenticated_delete_live_sessions') THEN
    CREATE POLICY "authenticated_delete_live_sessions" ON live_sessions FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Live Products
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_products' AND policyname = 'authenticated_select_live_products') THEN
    CREATE POLICY "authenticated_select_live_products" ON live_products FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_products' AND policyname = 'authenticated_insert_live_products') THEN
    CREATE POLICY "authenticated_insert_live_products" ON live_products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_products' AND policyname = 'authenticated_update_live_products') THEN
    CREATE POLICY "authenticated_update_live_products" ON live_products FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_products' AND policyname = 'authenticated_delete_live_products') THEN
    CREATE POLICY "authenticated_delete_live_products" ON live_products FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Live Orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_orders' AND policyname = 'authenticated_select_live_orders') THEN
    CREATE POLICY "authenticated_select_live_orders" ON live_orders FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_orders' AND policyname = 'authenticated_insert_live_orders') THEN
    CREATE POLICY "authenticated_insert_live_orders" ON live_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_orders' AND policyname = 'authenticated_update_live_orders') THEN
    CREATE POLICY "authenticated_update_live_orders" ON live_orders FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_orders' AND policyname = 'authenticated_delete_live_orders') THEN
    CREATE POLICY "authenticated_delete_live_orders" ON live_orders FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Live Phases
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_phases' AND policyname = 'authenticated_select_live_phases') THEN
    CREATE POLICY "authenticated_select_live_phases" ON live_phases FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_phases' AND policyname = 'authenticated_insert_live_phases') THEN
    CREATE POLICY "authenticated_insert_live_phases" ON live_phases FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_phases' AND policyname = 'authenticated_update_live_phases') THEN
    CREATE POLICY "authenticated_update_live_phases" ON live_phases FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_phases' AND policyname = 'authenticated_delete_live_phases') THEN
    CREATE POLICY "authenticated_delete_live_phases" ON live_phases FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Livestream Reports
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'livestream_reports' AND policyname = 'authenticated_select_livestream_reports') THEN
    CREATE POLICY "authenticated_select_livestream_reports" ON livestream_reports FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'livestream_reports' AND policyname = 'authenticated_insert_livestream_reports') THEN
    CREATE POLICY "authenticated_insert_livestream_reports" ON livestream_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'livestream_reports' AND policyname = 'authenticated_update_livestream_reports') THEN
    CREATE POLICY "authenticated_update_livestream_reports" ON livestream_reports FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'livestream_reports' AND policyname = 'authenticated_delete_livestream_reports') THEN
    CREATE POLICY "authenticated_delete_livestream_reports" ON livestream_reports FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;