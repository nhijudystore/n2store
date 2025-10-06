import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Copy, ChevronDown, ChevronUp, ShoppingCart, Key, Save, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { getTPOSProduct, parseVariantToAttributes, createAttributeLines, generateVariants, createPayload, postTPOSVariantPayload, getExistingColors } from "@/lib/tpos-variant-creator";
import { TPOS_ATTRIBUTES } from "@/lib/variant-attributes";

const Settings = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  
  const [topValue, setTopValue] = useState("20");
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [ordersResult, setOrdersResult] = useState<any>(null);
  const [isOrdersJsonOpen, setIsOrdersJsonOpen] = useState(false);
  
  const [bearerToken, setBearerToken] = useState("");
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [currentToken, setCurrentToken] = useState<any>(null);
  
  // Test Variant Creator states
  const [testProductId, setTestProductId] = useState("107831");
  const [isGettingProduct, setIsGettingProduct] = useState(false);
  const [testProduct, setTestProduct] = useState<any>(null);
  const [selectedSizeText, setSelectedSizeText] = useState<number[]>([]);
  const [selectedSizeNumber, setSelectedSizeNumber] = useState<number[]>([]);
  const [selectedColor, setSelectedColor] = useState<number[]>([]);
  const [isPostingVariant, setIsPostingVariant] = useState(false);
  const [variantPostResult, setVariantPostResult] = useState<any>(null);
  const [isTestJsonOpen, setIsTestJsonOpen] = useState(false);
  
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: "JSON đã được sao chép vào clipboard",
    });
  };

  const handleCheckImages = async () => {
    setIsChecking(true);
    setCheckResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-tpos-images');
      
      if (error) throw error;
      
      if (data.success) {
        setCheckResult(data);
        toast({
          title: "Kiểm tra hoàn tất",
          description: `Tìm thấy ${data.summary.total_tpos_products} sản phẩm từ TPOS`,
        });
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch (error: any) {
      console.error("Check images error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi kiểm tra",
        description: error.message === "Unauthorized" 
          ? "Token TPOS đã hết hạn. Vui lòng cập nhật token mới trong Secrets."
          : error.message,
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSyncImages = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-tpos-images');
      
      if (error) throw error;
      
      if (data.success) {
        setSyncResult(data);
        toast({
          title: "Đồng bộ thành công",
          description: `Đã cập nhật ${data.summary.updated} sản phẩm`,
        });
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch (error: any) {
      console.error("Sync images error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi đồng bộ",
        description: error.message === "Unauthorized"
          ? "Token TPOS đã hết hạn. Vui lòng cập nhật token mới trong Secrets."
          : error.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const loadCurrentToken = async () => {
    setIsLoadingToken(true);
    try {
      const { data, error } = await supabase
        .from("tpos_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setCurrentToken(data);
        setBearerToken(data.bearer_token);
        toast({
          title: "Tải token thành công",
          description: "Token hiện tại đã được tải",
        });
      } else {
        toast({
          title: "Chưa có token",
          description: "Chưa có token nào được lưu trong hệ thống",
        });
      }
    } catch (error: any) {
      console.error("Load token error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi tải token",
        description: error.message,
      });
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleUpdateToken = async () => {
    if (!bearerToken.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập Bearer Token",
      });
      return;
    }
    
    setIsUpdatingToken(true);
    
    try {
      // Deactivate all existing tokens
      const { error: deactivateError } = await supabase
        .from("tpos_config")
        .update({ is_active: false })
        .eq("is_active", true);
      
      if (deactivateError) throw deactivateError;
      
      // Insert new token
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tpos_config")
        .insert({
          bearer_token: bearerToken.trim(),
          is_active: true,
          created_by: userData.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log via edge function
      await supabase.functions.invoke('update-tpos-token', {
        body: { bearerToken: bearerToken.trim() }
      });
      
      setCurrentToken(data);
      
      toast({
        title: "✅ Cập nhật thành công",
        description: "Bearer Token đã được lưu vào database và sẵn sàng sử dụng",
      });
    } catch (error: any) {
      console.error("Update token error:", error);
      toast({
        variant: "destructive",
        title: "❌ Lỗi cập nhật",
        description: error.message,
      });
    } finally {
      setIsUpdatingToken(false);
    }
  };

  const handleFetchOrders = async () => {
    setIsFetchingOrders(true);
    setOrdersResult(null);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: "Chưa có TPOS Bearer Token. Vui lòng cập nhật token trước.",
        });
        return;
      }
      
      // Get today's date range (00:00:00 to 23:59:59)
      const today = new Date();
      const startDate = new Date(today.setHours(0, 0, 0, 0));
      const endDate = new Date(today.setHours(23, 59, 59, 999));
      
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$top=${topValue}&$orderby=DateCreated desc&$filter=(DateCreated ge ${startDateStr} and DateCreated le ${endDateStr})&$count=true`;
      
      const response = await fetch(url, {
        headers: getTPOSHeaders(token),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOrdersResult(data);
      
      toast({
        title: "Lấy đơn hàng thành công",
        description: `Tìm thấy ${data["@odata.count"] || data.value?.length || 0} đơn hàng`,
      });
    } catch (error: any) {
      console.error("Fetch orders error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi lấy đơn hàng",
        description: error.message,
      });
    } finally {
      setIsFetchingOrders(false);
    }
  };

  const handleGetTestProduct = async () => {
    if (!testProductId.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập TPOS Product ID",
      });
      return;
    }

    setIsGettingProduct(true);
    setTestProduct(null);
    setSelectedSizeText([]);
    setSelectedSizeNumber([]);
    setSelectedColor([]);
    setVariantPostResult(null);

    try {
      const product = await getTPOSProduct(parseInt(testProductId));
      setTestProduct(product);
      toast({
        title: "Lấy sản phẩm thành công",
        description: `${product.Name}`,
      });
    } catch (error: any) {
      console.error("Get product error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi lấy sản phẩm",
        description: error.message,
      });
    } finally {
      setIsGettingProduct(false);
    }
  };

  const handlePostVariant = async () => {
    if (!testProduct) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng GET sản phẩm trước",
      });
      return;
    }

    if (selectedSizeText.length === 0 && selectedSizeNumber.length === 0 && selectedColor.length === 0) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất một attribute",
      });
      return;
    }

    setIsPostingVariant(true);
    setVariantPostResult(null);

    try {
      // ⭐ MỚI: Lấy màu đã tồn tại
      const existingColors = getExistingColors(testProduct);
      console.log(`📋 Màu đã có trên TPOS (${existingColors.size}):`, Array.from(existingColors));
      
      // Build selected attributes
      const selectedAttributes: any = {};
      
      if (selectedSizeText.length > 0) {
        selectedAttributes.sizeText = TPOS_ATTRIBUTES.sizeText.filter(attr => 
          selectedSizeText.includes(attr.Id)
        );
      }
      
      if (selectedSizeNumber.length > 0) {
        selectedAttributes.sizeNumber = TPOS_ATTRIBUTES.sizeNumber.filter(attr => 
          selectedSizeNumber.includes(attr.Id)
        );
      }
      
      if (selectedColor.length > 0) {
        // ⭐ MỚI: Lọc màu trùng
        const originalColors = TPOS_ATTRIBUTES.color.filter(attr => 
          selectedColor.includes(attr.Id)
        );
        
        selectedAttributes.color = originalColors.filter(
          color => !existingColors.has(color.Id)
        );
        
        const filteredCount = originalColors.length - selectedAttributes.color.length;
        if (filteredCount > 0) {
          const skippedColorNames = originalColors
            .filter(c => existingColors.has(c.Id))
            .map(c => c.Name)
            .join(', ');
          
          toast({
            title: "⚠️ Cảnh báo",
            description: `${filteredCount} màu đã tồn tại: ${skippedColorNames}`,
          });
        }
        
        if (selectedAttributes.color.length === 0 && selectedSizeText.length === 0 && selectedSizeNumber.length === 0) {
          toast({
            title: "ℹ️ Thông báo",
            description: "Tất cả màu đã tồn tại, không có gì để tạo",
          });
          setIsPostingVariant(false);
          return;
        }
      }

      // Create attribute lines
      const attributeLines = createAttributeLines(selectedAttributes);
      
      // Generate variants
      const variants = generateVariants(testProduct, attributeLines);
      
      // Create payload
      const payload = createPayload(testProduct, attributeLines, variants);
      
      // Post to TPOS
      const result = await postTPOSVariantPayload(payload);
      
      setVariantPostResult(result);
      
      const newVariantCount = variants.filter((v: any) => v.Id === 0).length;
      toast({
        title: "✅ Tạo variant thành công",
        description: `Đã tạo ${newVariantCount} variants mới`,
      });
    } catch (error: any) {
      console.error("Post variant error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi tạo variant",
        description: error.message,
      });
    } finally {
      setIsPostingVariant(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-muted-foreground mt-2">Quản lý các cài đặt hệ thống</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Quản lý ảnh TPOS
          </CardTitle>
          <CardDescription>
            Kiểm tra và đồng bộ hóa ảnh sản phẩm từ hệ thống TPOS về database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={handleCheckImages}
              disabled={isChecking || isSyncing}
              variant="outline"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang kiểm tra...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Kiểm tra ảnh TPOS
                </>
              )}
            </Button>

            <Button
              onClick={handleSyncImages}
              disabled={isChecking || isSyncing}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang đồng bộ...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Đồng bộ ảnh TPOS
                </>
              )}
            </Button>
          </div>

          {checkResult && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Kết quả kiểm tra</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Tổng sản phẩm TPOS:</span>
                    <Badge variant="secondary">{checkResult.summary.total_tpos_products}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Sản phẩm trong DB:</span>
                    <Badge variant="secondary">{checkResult.summary.total_db_products}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Thiếu ảnh:</span>
                    <Badge variant="destructive">{checkResult.summary.missing_images}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Không tìm thấy trong TPOS:</span>
                    <Badge variant="outline">{checkResult.summary.not_found_in_tpos}</Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {syncResult && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Kết quả đồng bộ</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Tổng sản phẩm xử lý:</span>
                    <Badge variant="secondary">{syncResult.summary.total_products}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Đã cập nhật:</span>
                    <Badge>{syncResult.summary.updated}</Badge>
                  </div>
                  {syncResult.summary.skipped > 0 && (
                    <div className="flex justify-between">
                      <span>Đã đồng bộ trước đó:</span>
                      <Badge variant="outline">{syncResult.summary.skipped}</Badge>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Không tìm thấy trong TPOS:</span>
                    <Badge variant="outline">{syncResult.summary.not_found_in_tpos}</Badge>
                  </div>
                  {syncResult.summary.errors > 0 && (
                    <div className="flex justify-between">
                      <span>Lỗi:</span>
                      <Badge variant="destructive">{syncResult.summary.errors}</Badge>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {(checkResult || syncResult) && (
            <Collapsible open={isJsonOpen} onOpenChange={setIsJsonOpen}>
              <Card className="border-dashed">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                      {isJsonOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-4">
                      {checkResult && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Check Result:</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(JSON.stringify(checkResult, null, 2))}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                            {JSON.stringify(checkResult, null, 2)}
                          </pre>
                        </div>
                      )}
                      {syncResult && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Sync Result:</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(JSON.stringify(syncResult, null, 2))}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                            {JSON.stringify(syncResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Cập nhật TPOS Bearer Token
          </CardTitle>
          <CardDescription>
            Quản lý Bearer Token để kết nối với hệ thống TPOS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bearer Token</label>
            <Textarea
              value={bearerToken}
              onChange={(e) => setBearerToken(e.target.value)}
              placeholder="Nhập Bearer Token từ TPOS..."
              className="min-h-[100px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Token này sẽ được sử dụng để gọi API TPOS. Vui lòng lấy token mới từ TPOS khi token cũ hết hạn.
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handleUpdateToken}
              disabled={isUpdatingToken || !bearerToken.trim()}
            >
              {isUpdatingToken ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang cập nhật...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Cập nhật Token
                </>
              )}
            </Button>
            
            <Button
              onClick={loadCurrentToken}
              variant="outline"
              disabled={isLoadingToken}
            >
              {isLoadingToken ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tải token hiện tại
                </>
              )}
            </Button>
          </div>
          
          {currentToken && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Token hiện tại</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Đã lưu lúc:</span>
                    <Badge variant="secondary">
                      {new Date(currentToken.updated_at).toLocaleString('vi-VN')}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Trạng thái:</span>
                    <Badge variant={currentToken.is_active ? "default" : "secondary"}>
                      {currentToken.is_active ? "Đang hoạt động" : "Không hoạt động"}
                    </Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Đơn hàng TPOS
          </CardTitle>
          <CardDescription>
            Lấy danh sách đơn hàng online từ TPOS theo ngày hôm nay
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Số lượng đơn hàng</label>
              <Select value={topValue} onValueChange={setTopValue}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Chọn số lượng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 đơn</SelectItem>
                  <SelectItem value="50">50 đơn</SelectItem>
                  <SelectItem value="200">200 đơn</SelectItem>
                  <SelectItem value="1000">1000 đơn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button
              onClick={handleFetchOrders}
              disabled={isFetchingOrders}
            >
              {isFetchingOrders ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang lấy...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Lấy đơn hàng
                </>
              )}
            </Button>
          </div>

          {ordersResult && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Kết quả</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Tổng số đơn hàng:</span>
                    <Badge variant="secondary">
                      {ordersResult["@odata.count"] || ordersResult.value?.length || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Đơn hàng hiển thị:</span>
                    <Badge>{ordersResult.value?.length || 0}</Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {ordersResult && (
            <Collapsible open={isOrdersJsonOpen} onOpenChange={setIsOrdersJsonOpen}>
              <Card className="border-dashed">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                      {isOrdersJsonOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Orders Response:</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(JSON.stringify(ordersResult, null, 2))}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                      {JSON.stringify(ordersResult, null, 2)}
                    </pre>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5" />
            Test Variant Creator
          </CardTitle>
          <CardDescription>
            Test việc tạo variant trên TPOS với product ID và attributes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">TPOS Product ID</label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={testProductId}
                onChange={(e) => setTestProductId(e.target.value)}
                placeholder="Nhập TPOS Product ID..."
                className="flex-1"
              />
              <Button
                onClick={handleGetTestProduct}
                disabled={isGettingProduct}
                variant="outline"
              >
                {isGettingProduct ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Getting...
                  </>
                ) : (
                  "GET Product"
                )}
              </Button>
            </div>
          </div>

          {testProduct && (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Product Retrieved</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <Badge variant="secondary">{testProduct.Name}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Code:</span>
                      <Badge variant="outline">{testProduct.DefaultCode}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Price:</span>
                      <Badge>{testProduct.ListPrice?.toLocaleString()} VNĐ</Badge>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-medium">Chọn Attributes</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Size Chữ</label>
                    <div className="grid grid-cols-4 gap-2">
                      {TPOS_ATTRIBUTES.sizeText.map((attr) => (
                        <div key={attr.Id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`size-text-${attr.Id}`}
                            checked={selectedSizeText.includes(attr.Id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSizeText([...selectedSizeText, attr.Id]);
                              } else {
                                setSelectedSizeText(selectedSizeText.filter(id => id !== attr.Id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`size-text-${attr.Id}`}
                            className="text-sm cursor-pointer"
                          >
                            {attr.Name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Size Số</label>
                    <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                      {TPOS_ATTRIBUTES.sizeNumber.map((attr) => (
                        <div key={attr.Id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`size-number-${attr.Id}`}
                            checked={selectedSizeNumber.includes(attr.Id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSizeNumber([...selectedSizeNumber, attr.Id]);
                              } else {
                                setSelectedSizeNumber(selectedSizeNumber.filter(id => id !== attr.Id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`size-number-${attr.Id}`}
                            className="text-sm cursor-pointer"
                          >
                            {attr.Name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Màu</label>
                    <div className="grid grid-cols-3 gap-2">
                      {TPOS_ATTRIBUTES.color.map((attr) => (
                        <div key={attr.Id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`color-${attr.Id}`}
                            checked={selectedColor.includes(attr.Id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedColor([...selectedColor, attr.Id]);
                              } else {
                                setSelectedColor(selectedColor.filter(id => id !== attr.Id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`color-${attr.Id}`}
                            className="text-sm cursor-pointer"
                          >
                            {attr.Name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handlePostVariant}
                  disabled={isPostingVariant}
                  className="w-full"
                >
                  {isPostingVariant ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Đang POST...
                    </>
                  ) : (
                    "POST Create Variants"
                  )}
                </Button>
              </div>

              {variantPostResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Variant Created</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 text-sm">
                      Response đã nhận. Xem chi tiết bên dưới.
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Collapsible open={isTestJsonOpen} onOpenChange={setIsTestJsonOpen}>
                <Card className="border-dashed">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                        {isTestJsonOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="space-y-4">
                        {testProduct && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">GET Product Response:</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(JSON.stringify(testProduct, null, 2))}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                              {JSON.stringify(testProduct, null, 2)}
                            </pre>
                          </div>
                        )}
                        {variantPostResult && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">POST Variant Response:</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(JSON.stringify(variantPostResult, null, 2))}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                              {JSON.stringify(variantPostResult, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
