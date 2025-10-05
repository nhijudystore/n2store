import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import PurchaseOrders from "./pages/PurchaseOrders";
import Products from "./pages/Products";
import LiveProducts from "./pages/LiveProducts";
import LivestreamReports from "./pages/LivestreamReports";
import GoodsReceiving from "./pages/GoodsReceiving";
import SearchProducts from "./pages/SearchProducts";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <PurchaseOrders />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/purchase-orders" element={
              <ProtectedRoute>
                <Layout>
                  <PurchaseOrders />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/products" element={
              <ProtectedRoute>
                <Layout>
                  <Products />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/live-products" element={
              <ProtectedRoute>
                <Layout>
                  <LiveProducts />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/livestream-reports" element={
              <ProtectedRoute>
                <Layout>
                  <LivestreamReports />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/goods-receiving" element={
              <ProtectedRoute>
                <Layout>
                  <GoodsReceiving />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/search-products" element={
              <ProtectedRoute>
                <Layout>
                  <SearchProducts />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <Sonner />
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
