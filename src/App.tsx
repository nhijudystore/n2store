import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { MobileNavigationProvider } from "@/contexts/MobileNavigationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import PurchaseOrders from "./pages/PurchaseOrders";
import LiveProducts from "./pages/LiveProducts";
import LivestreamReports from "./pages/LivestreamReports";
import GoodsReceiving from "./pages/GoodsReceiving";
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

const ConditionalLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }
  
  return <Layout>{children}</Layout>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <AuthProvider>
          <MobileNavigationProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <ConditionalLayout>
                    <PurchaseOrders />
                  </ConditionalLayout>
                </ProtectedRoute>
              } />
              <Route path="/purchase-orders" element={
                <ProtectedRoute>
                  <ConditionalLayout>
                    <PurchaseOrders />
                  </ConditionalLayout>
                </ProtectedRoute>
              } />
              <Route path="/live-products" element={
                <ProtectedRoute>
                  <ConditionalLayout>
                    <LiveProducts />
                  </ConditionalLayout>
                </ProtectedRoute>
              } />
              <Route path="/livestream-reports" element={
                <ProtectedRoute>
                  <ConditionalLayout>
                    <LivestreamReports />
                  </ConditionalLayout>
                </ProtectedRoute>
              } />
              <Route path="/goods-receiving" element={
                <ProtectedRoute>
                  <ConditionalLayout>
                    <GoodsReceiving />
                  </ConditionalLayout>
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
            <Sonner />
          </MobileNavigationProvider>
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
