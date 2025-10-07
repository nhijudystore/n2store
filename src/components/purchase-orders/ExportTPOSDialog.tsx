import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Loader2, CheckSquare, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToTPOS, generateTPOSExcel, type TPOSProductItem } from "@/lib/tpos-api";
import { createTPOSVariants } from "@/lib/tpos-variant-creator";
import { formatVND } from "@/lib/currency-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExportTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TPOSProductItem[];
  onSuccess?: () => void;
}

export function ExportTPOSDialog({ open, onOpenChange, items, onSuccess }: ExportTPOSDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map(item => item.id)));
  const [imageFilter, setImageFilter] = useState<"all" | "with-images" | "without-images" | "uploaded-tpos" | "not-uploaded-tpos">("all");

  // Filter items based on image filter
  const filteredItems = useMemo(() => {
    switch (imageFilter) {
      case "with-images":
        return items.filter(item => item.product_images && item.product_images.length > 0);
      case "without-images":
        return items.filter(item => !item.product_images || item.product_images.length === 0);
      case "uploaded-tpos":
        return items.filter(item => item.tpos_product_id);
      case "not-uploaded-tpos":
        return items.filter(item => !item.tpos_product_id);
      default:
        return items;
    }
  }, [items, imageFilter]);

  // Get selected items
  const selectedItems = useMemo(() => {
    return filteredItems.filter(item => selectedIds.has(item.id));
  }, [filteredItems, selectedIds]);

  const itemsWithImages = items.filter(
    (item) => item.product_images && item.product_images.length > 0
  );
  const itemsWithoutImages = items.filter(
    (item) => !item.product_images || item.product_images.length === 0
  );
  const itemsUploadedToTPOS = items.filter(item => item.tpos_product_id);
  const itemsNotUploadedToTPOS = items.filter(item => !item.tpos_product_id);

  // Toggle single item
  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all filtered items
  const toggleAll = () => {
    if (selectedItems.length === filteredItems.length) {
      // Deselect all filtered items
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredItems.forEach(item => next.delete(item.id));
        return next;
      });
    } else {
      // Select all filtered items
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredItems.forEach(item => next.add(item.id));
        return next;
      });
    }
  };

  const isAllSelected = selectedItems.length === filteredItems.length && filteredItems.length > 0;
  const isSomeSelected = selectedItems.length > 0 && selectedItems.length < filteredItems.length;

  const handleDownloadExcel = () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Chưa chọn sản phẩm",
        description: "Vui lòng chọn ít nhất một sản phẩm",
        variant: "destructive",
      });
      return;
    }

    // Check if any selected items already have TPOS ID
    const itemsWithTPOS = selectedItems.filter(item => item.tpos_product_id);
    if (itemsWithTPOS.length > 0) {
      toast({
        title: "⚠️ Cảnh báo",
        description: `${itemsWithTPOS.length} sản phẩm đã có TPOS ID. Bạn có chắc muốn tải lại?`,
      });
    }

    try {
      const excelBlob = generateTPOSExcel(selectedItems);
      const url = URL.createObjectURL(excelBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TPOS_Export_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "📥 Tải xuống thành công",
        description: `Đã tạo file Excel với ${selectedItems.length} sản phẩm`,
      });
    } catch (error) {
      toast({
        title: "❌ Lỗi",
        description: "Không thể tạo file Excel",
        variant: "destructive",
      });
    }
  };

  const handleUploadToTPOS = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Chưa chọn sản phẩm",
        description: "Vui lòng chọn ít nhất một sản phẩm",
        variant: "destructive",
      });
      return;
    }

    // Check if any selected items already have TPOS ID
    const itemsWithTPOS = selectedItems.filter(item => item.tpos_product_id);
    if (itemsWithTPOS.length > 0) {
      const confirmed = window.confirm(
        `⚠️ Cảnh báo: ${itemsWithTPOS.length} sản phẩm đã có TPOS ID.\n\nBạn có chắc muốn upload lại không? Điều này có thể tạo duplicate trên TPOS.`
      );
      if (!confirmed) return;
    }

    // Group items by product_code
    const groupedByProductCode = new Map<string, TPOSProductItem[]>();
    selectedItems.forEach(item => {
      const code = item.product_code || 'NO_CODE';
      if (!groupedByProductCode.has(code)) {
        groupedByProductCode.set(code, []);
      }
      groupedByProductCode.get(code)!.push(item);
    });

    console.log(`📦 Grouped ${selectedItems.length} items into ${groupedByProductCode.size} product codes`);
    groupedByProductCode.forEach((items, code) => {
      const variants = items.map(i => i.variant).filter(Boolean);
      console.log(`  - ${code}: ${items.length} items, variants: ${variants.join(', ')}`);
    });

    // Check existing products and variants in database
    setCurrentStep("Đang kiểm tra sản phẩm trong kho...");
    const productCodes = Array.from(groupedByProductCode.keys()).filter(code => code !== 'NO_CODE');
    
    const { data: existingProducts } = await supabase
      .from("products")
      .select("product_code, variant, tpos_product_id")
      .in("product_code", productCodes);

    // Map existing variants by product_code
    const existingVariantsMap = new Map<string, Set<string>>();
    const existingTPOSIds = new Map<string, number>();
    
    existingProducts?.forEach(p => {
      if (!existingVariantsMap.has(p.product_code)) {
        existingVariantsMap.set(p.product_code, new Set());
      }
      if (p.variant) {
        existingVariantsMap.get(p.product_code)!.add(p.variant);
      }
      if (p.tpos_product_id) {
        existingTPOSIds.set(p.product_code, p.tpos_product_id);
      }
    });

    console.log(`📋 Found ${existingProducts?.length || 0} existing products in database`);
    existingVariantsMap.forEach((variants, code) => {
      console.log(`  - ${code}: existing variants: ${Array.from(variants).join(', ')}`);
    });

    // Prepare items for upload - only NEW variants not in database
    const itemsToUpload: TPOSProductItem[] = [];
    const variantMapping = new Map<string, { 
      items: TPOSProductItem[], 
      combinedVariant: string,
      existingTPOSId?: number 
    }>();

    groupedByProductCode.forEach((items, productCode) => {
      // Get existing variants for this product code
      const existingVariants = existingVariantsMap.get(productCode) || new Set();
      const existingTPOSId = existingTPOSIds.get(productCode);
      
      // Filter to get only NEW variants
      const newVariantItems = items.filter(item => {
        if (!item.variant) return !existingVariants.has(''); // No variant case
        return !existingVariants.has(item.variant);
      });

      if (newVariantItems.length === 0) {
        console.log(`⏭️  Skipping ${productCode}: all variants already exist in database`);
        return; // Skip this product code - all variants already exist
      }

      console.log(`✨ ${productCode}: ${newVariantItems.length} NEW variants to upload`);
      
      // Use first NEW item as representative
      const representative = { ...newVariantItems[0] };
      
      // Collect only NEW variants
      const newVariants = newVariantItems
        .map(i => i.variant)
        .filter((v): v is string => Boolean(v))
        .filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
      
      const combinedVariant = newVariants.join(', ');
      
      // Check if product already exists on TPOS
      if (existingTPOSId) {
        console.log(`🔗 ${productCode}: Product exists on TPOS (ID: ${existingTPOSId}), will only add new variants`);
        // Store for variant creation only
        if (combinedVariant) {
          variantMapping.set(productCode, {
            items: newVariantItems,
            combinedVariant: combinedVariant,
            existingTPOSId: existingTPOSId
          });
        }
      } else {
        // Product doesn't exist on TPOS yet - need to upload
        console.log(`📤 ${productCode}: New product, will upload to TPOS`);
        
        if (combinedVariant) {
          variantMapping.set(productCode, {
            items: newVariantItems,
            combinedVariant: combinedVariant
          });
          // Remove variant from upload payload (will be created later)
          representative.variant = null;
        }
        
        itemsToUpload.push(representative);
      }
    });

    console.log(`🚀 Will upload ${itemsToUpload.length} NEW products to TPOS`);
    console.log(`🎨 Will create variants for ${variantMapping.size} products`);

    if (itemsToUpload.length === 0 && variantMapping.size === 0) {
      toast({
        title: "⚠️ Không có sản phẩm mới",
        description: "Tất cả các biến thể đã tồn tại trong kho sản phẩm",
      });
      setIsUploading(false);
      return;
    }

    // Thông báo bắt đầu upload
    toast({
      title: "Bắt đầu upload",
      description: `Đang upload ${itemsToUpload.length} sản phẩm (${selectedItems.length} items) lên TPOS...`,
    });

    setIsUploading(true);
    setProgress(0);
    setCurrentStep("Đang bắt đầu...");

    try {
      // Upload NEW products to TPOS (those that don't exist yet)
      let result: any = {
        success: false,
        totalProducts: itemsToUpload.length,
        successCount: 0,
        failedCount: 0,
        savedIds: 0,
        errors: [],
        imageUploadWarnings: [],
        productIds: [],
      };

      if (itemsToUpload.length > 0) {
        result = await uploadToTPOS(itemsToUpload, (step, total, message) => {
          setProgress((step / total) * 100);
          setCurrentStep(message);
        });

        // Log TPOS response
        console.log("TPOS Upload Result:", JSON.stringify(result, null, 2));
      } else {
        console.log("⏭️  No new products to upload - will only add variants to existing products");
        result.success = true;
        result.totalProducts = 0;
        result.successCount = 0;
      }

      // Save TPOS IDs to Supabase - update ALL items in the group
      if (result.productIds.length > 0) {
        setCurrentStep("Đang lưu TPOS IDs vào database...");
        
        // Map TPOS IDs back to all original items in the group
        const allItemUpdates: Array<{ itemId: string; tposId: number }> = [];
        
        for (const { itemId, tposId } of result.productIds) {
          // Find the representative item
          const representative = itemsToUpload.find(i => i.id === itemId);
          if (!representative || !representative.product_code) continue;
          
          // Get all NEW items in this group (from variantMapping)
          const variantInfo = variantMapping.get(representative.product_code);
          if (!variantInfo) continue;
          
          // Update ALL NEW items in the group with the same TPOS ID
          for (const groupItem of variantInfo.items) {
            allItemUpdates.push({ itemId: groupItem.id, tposId });
            await supabase
              .from("purchase_order_items")
              .update({ tpos_product_id: tposId })
              .eq("id", groupItem.id);
          }
        }
        
        console.log(`💾 Saved TPOS IDs to ${allItemUpdates.length} items (including grouped items)`);
        result.savedIds = allItemUpdates.length;

        // Insert NEW products to inventory (not upsert - only new variants)
        setCurrentStep("Đang thêm sản phẩm mới vào kho hàng...");
        
        // Create a map of product_code to tpos_product_id for new products
        const productCodeToTPOSId = new Map<string, number>();
        for (const { itemId, tposId } of result.productIds) {
          const representative = itemsToUpload.find(i => i.id === itemId);
          if (representative?.product_code) {
            productCodeToTPOSId.set(representative.product_code, tposId);
          }
        }
        
        // Collect unique variants to insert (deduplicate by product_code + variant)
        const uniqueVariantsToInsert = new Map<string, TPOSProductItem>();
        
        for (const [productCode, variantInfo] of variantMapping) {
          const tposId = productCodeToTPOSId.get(productCode);
          if (!tposId) continue; // Skip if no TPOS ID (not a new product)
          
          // Deduplicate variants - only keep one item per unique (product_code, variant) combo
          for (const item of variantInfo.items) {
            const uniqueKey = `${item.product_code}|||${item.variant || ''}`;
            if (!uniqueVariantsToInsert.has(uniqueKey)) {
              uniqueVariantsToInsert.set(uniqueKey, { ...item, tpos_product_id: tposId });
            }
          }
        }
        
        console.log(`📦 Deduplicated to ${uniqueVariantsToInsert.size} unique variants to insert`);
        
        // Insert each unique variant as a separate product entry
        let insertedCount = 0;
        for (const item of uniqueVariantsToInsert.values()) {
          const { error: productError } = await supabase
            .from("products")
            .insert({
              product_code: item.product_code,
              product_name: item.product_name,
              variant: item.variant || null,
              purchase_price: item.unit_price || 0,
              selling_price: item.selling_price || 0,
              supplier_name: item.supplier_name || '',
              product_images: item.product_images?.length > 0 ? item.product_images : null,
              price_images: item.price_images?.length > 0 ? item.price_images : null,
              stock_quantity: 0,
              unit: 'Cái',
              tpos_product_id: item.tpos_product_id
            })
            .select()
            .single();

          if (productError && productError.code !== '23505') { // Ignore duplicate key error
            console.error('Error inserting product variant:', productError);
          } else if (!productError) {
            insertedCount++;
          }
        }
        
        result.productsAddedToInventory = insertedCount;
        console.log(`✅ Successfully inserted ${insertedCount} unique product variants to inventory`);

        // Auto-create variants for NEW products uploaded to TPOS
        setCurrentStep("Đang tạo biến thể cho sản phẩm mới...");
        result.variantsCreated = 0;
        result.variantsFailed = 0;
        result.variantErrors = [];

        for (const { itemId, tposId } of result.productIds) {
          const representative = itemsToUpload.find(i => i.id === itemId);
          if (!representative?.product_code) continue;
          
          const variantInfo = variantMapping.get(representative.product_code);
          if (!variantInfo) continue;
          
          const { combinedVariant } = variantInfo;

          try {
            console.log(`🎨 Creating variants for: ${representative.product_name} (TPOS ID: ${tposId})`);
            console.log(`   Combined variants: ${combinedVariant}`);
            setCurrentStep(`Đang tạo biến thể cho: ${representative.product_name}...`);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await createTPOSVariants(
              tposId,
              combinedVariant,
              (msg) => {
                console.log(`  → ${msg}`);
                setCurrentStep(`${representative.product_name}: ${msg}`);
              }
            );
            
            console.log(`✅ Variants created for ${representative.product_name}`);
            result.variantsCreated++;
          } catch (error) {
            console.error(`❌ Failed to create variants for ${representative.product_name}:`, error);
            result.variantsFailed++;
            result.variantErrors.push({
              productName: representative.product_name,
              productCode: representative.product_code || 'N/A',
              errorMessage: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      // Handle products that already exist on TPOS - add new variants only
      const existingTPOSProducts = Array.from(variantMapping.entries())
        .filter(([_, info]) => info.existingTPOSId !== undefined);

      if (existingTPOSProducts.length > 0) {
        setCurrentStep("Đang thêm biến thể mới vào sản phẩm có sẵn...");
        console.log(`🔗 Adding variants to ${existingTPOSProducts.length} existing TPOS products`);

        for (const [productCode, variantInfo] of existingTPOSProducts) {
          const { existingTPOSId, combinedVariant, items } = variantInfo;
          if (!existingTPOSId) continue;

          try {
            console.log(`🎨 Adding variants to existing product: ${productCode} (TPOS ID: ${existingTPOSId})`);
            console.log(`   New variants: ${combinedVariant}`);
            setCurrentStep(`Đang thêm biến thể cho: ${productCode}...`);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await createTPOSVariants(
              existingTPOSId,
              combinedVariant,
              (msg) => {
                console.log(`  → ${msg}`);
                setCurrentStep(`${productCode}: ${msg}`);
              }
            );
            
            console.log(`✅ Variants added to ${productCode}`);
            result.variantsCreated = (result.variantsCreated || 0) + 1;

            // Insert new variants to products table
            for (const item of items) {
              const { error: productError } = await supabase
                .from("products")
                .insert({
                  product_code: item.product_code,
                  product_name: item.product_name,
                  variant: item.variant || null,
                  purchase_price: item.unit_price || 0,
                  selling_price: item.selling_price || 0,
                  supplier_name: item.supplier_name || '',
                  product_images: item.product_images?.length > 0 ? item.product_images : null,
                  price_images: item.price_images?.length > 0 ? item.price_images : null,
                  stock_quantity: 0,
                  unit: 'Cái',
                  tpos_product_id: existingTPOSId
                })
                .select()
                .single();

              if (productError && productError.code !== '23505') {
                console.error('Error inserting variant:', productError);
              }

              // Update purchase_order_items with TPOS ID
              await supabase
                .from("purchase_order_items")
                .update({ tpos_product_id: existingTPOSId })
                .eq("id", item.id);
            }

            result.productsAddedToInventory = (result.productsAddedToInventory || 0) + items.length;
          } catch (error) {
            console.error(`❌ Failed to add variants for ${productCode}:`, error);
            result.variantsFailed = (result.variantsFailed || 0) + 1;
            if (!result.variantErrors) result.variantErrors = [];
            result.variantErrors.push({
              productName: productCode,
              productCode: productCode,
              errorMessage: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      // Thông báo kết quả chi tiết
      const successRate = ((result.successCount / result.totalProducts) * 100).toFixed(1);
      
      // Show TPOS response in notification
      const tposResponseInfo = result.productIds.length > 0 
        ? `\n🔗 TPOS Product IDs: ${result.productIds.map(p => p.tposId).join(', ')}`
        : '';
      
      toast({
        title: result.failedCount === 0 ? "🎉 Upload thành công!" : "⚠️ Upload hoàn tất",
        description: (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <div className="font-semibold">
              Tỷ lệ thành công: {successRate}%
            </div>
            <div className="space-y-1 text-sm">
              <p>✅ Thành công: {result.successCount}/{result.totalProducts} sản phẩm</p>
              <p>💾 Đã lưu TPOS IDs: {result.savedIds} sản phẩm</p>
              <p>📦 Đã thêm vào kho: {result.productsAddedToInventory || 0} sản phẩm</p>
              {result.variantsCreated !== undefined && result.variantsCreated > 0 && (
                <p className="text-green-600 dark:text-green-400">🎨 Đã tạo biến thể: {result.variantsCreated} sản phẩm</p>
              )}
              {result.variantsFailed !== undefined && result.variantsFailed > 0 && (
                <p className="text-yellow-600 dark:text-yellow-400">⚠️ Tạo biến thể thất bại: {result.variantsFailed} sản phẩm</p>
              )}
              {result.productIds.length > 0 && (
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  <p className="font-medium mb-1">TPOS Product IDs:</p>
                  {result.productIds.slice(0, 10).map((p, i) => (
                    <p key={i}>• ID {p.tposId}</p>
                  ))}
                  {result.productIds.length > 10 && (
                    <p className="text-muted-foreground italic">
                      ... và {result.productIds.length - 10} IDs khác
                    </p>
                  )}
                </div>
              )}
              {result.failedCount > 0 && (
                <p className="text-destructive font-medium">
                  ❌ Thất bại: {result.failedCount} sản phẩm
                </p>
              )}
              {result.imageUploadWarnings && result.imageUploadWarnings.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 font-semibold">
                    ⚠️ {result.imageUploadWarnings.length} sản phẩm upload ảnh thất bại (đã tạo trên TPOS)
                  </summary>
                  <div className="mt-2 space-y-2 text-xs max-h-64 overflow-y-auto">
                    {result.imageUploadWarnings.map((warning, i) => (
                      <div key={i} className="border-l-4 border-yellow-500 pl-3 py-2 bg-yellow-50 dark:bg-yellow-950/20 rounded">
                        <p className="font-bold text-yellow-800 dark:text-yellow-200 text-sm mb-1">
                          {i + 1}. {warning.productName} 
                          <span className="text-muted-foreground"> ({warning.productCode})</span>
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                          ✅ Đã tạo trên TPOS - ID: {warning.tposId}
                        </p>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">Lỗi upload ảnh:</p>
                          <pre className="bg-muted/80 p-2 rounded overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed font-mono border border-yellow-200 dark:border-yellow-800">
                            {warning.errorMessage}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {result.errors.length > 0 && (
                <details className="mt-2" open>
                  <summary className="cursor-pointer text-destructive hover:text-destructive/80 font-semibold">
                    ❌ Xem chi tiết {result.errors.length} lỗi
                  </summary>
                  <div className="mt-2 space-y-2 text-xs max-h-64 overflow-y-auto">
                    {result.errors.map((error, i) => (
                      <div key={i} className="border-l-4 border-destructive pl-3 py-2 bg-destructive/5 rounded">
                        <p className="font-bold text-destructive text-sm mb-1">
                          {i + 1}. {error.productName} 
                          {error.productCode !== 'N/A' && <span className="text-muted-foreground"> ({error.productCode})</span>}
                        </p>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">Chi tiết lỗi:</p>
                          <pre className="bg-muted/80 p-2 rounded overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed font-mono border border-destructive/20">
                            {error.errorMessage}
                          </pre>
                        </div>
                        {error.fullError?.details && (
                          <div className="mt-2 pt-2 border-t border-destructive/20">
                            <p className="text-[10px] text-muted-foreground font-medium mb-1">Debug info:</p>
                            <pre className="text-[10px] text-muted-foreground overflow-x-auto">
                              {JSON.stringify(error.fullError.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
                    <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                      💡 Các nguyên nhân thường gặp:
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-0.5 ml-4 list-disc">
                      <li>Thiếu trường bắt buộc (Tên sản phẩm, Mã sản phẩm, Giá bán...)</li>
                      <li>Format dữ liệu không đúng (giá phải là số, không có ký tự đặc biệt...)</li>
                      <li>Mã sản phẩm trùng lặp hoặc không hợp lệ</li>
                      <li>Tên sản phẩm quá dài hoặc chứa ký tự không cho phép</li>
                    </ul>
                  </div>
                </details>
              )}
            </div>
          </div>
        ),
        duration: 10000, // Hiển thị lâu hơn để user đọc kết quả
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Upload error:", errorMessage);
      
      // Parse error message to extract TPOS error details
      let parsedError = null;
      try {
        // Try to extract JSON from error message
        const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedError = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // Keep as is if parsing fails
      }
      
      toast({
        title: "❌ Lỗi upload lên TPOS",
        description: (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              <p className="font-semibold text-destructive mb-2">Chi tiết lỗi từ TPOS:</p>
              {parsedError ? (
                <div className="space-y-2">
                  {parsedError.errors && Array.isArray(parsedError.errors) && (
                    <div>
                      <p className="text-xs font-medium mb-1">
                        Có {parsedError.errors.length} lỗi được phát hiện:
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {parsedError.errors.slice(0, 5).map((err: any, i: number) => (
                          <div key={i} className="text-xs bg-background/50 p-2 rounded border border-destructive/20">
                            <p className="font-medium">
                              {err.row ? `Hàng ${err.row}: ` : ''}
                              {err.product_name || err.product_code || 'Unknown'}
                            </p>
                            <p className="text-destructive">
                              {err.error || err.message || 'No error message'}
                            </p>
                            {err.field && (
                              <p className="text-muted-foreground">Trường: {err.field}</p>
                            )}
                          </div>
                        ))}
                        {parsedError.errors.length > 5 && (
                          <p className="text-xs text-muted-foreground italic">
                            ... và {parsedError.errors.length - 5} lỗi khác
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <pre className="text-[10px] bg-background/50 p-2 rounded overflow-x-auto whitespace-pre-wrap border border-destructive/20 font-mono">
                    {JSON.stringify(parsedError, null, 2)}
                  </pre>
                </div>
              ) : (
                <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto whitespace-pre-wrap border border-destructive/20 font-mono">
                  {errorMessage}
                </pre>
              )}
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                💡 Các bước kiểm tra:
              </p>
              <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 ml-4 list-disc">
                <li><strong>Kết nối mạng:</strong> Kiểm tra kết nối internet</li>
                <li><strong>Token TPOS:</strong> Đảm bảo token còn hiệu lực và có quyền</li>
                <li><strong>Dữ liệu Excel:</strong> Kiểm tra các trường bắt buộc (Tên SP, Mã SP, Giá...)</li>
                <li><strong>Format:</strong> Đảm bảo giá là số, tên không có ký tự đặc biệt</li>
                <li><strong>Duplicate:</strong> Kiểm tra mã sản phẩm có bị trùng không</li>
              </ul>
            </div>
          </div>
        ),
        variant: "destructive",
        duration: 15000,
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export & Upload lên TPOS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Tổng sản phẩm</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Đã chọn</p>
              <p className="text-2xl font-bold text-primary">{selectedItems.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Có hình ảnh</p>
              <p className="text-2xl font-bold text-green-600">{itemsWithImages.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Đã upload TPOS</p>
              <p className="text-2xl font-bold text-blue-600">{itemsUploadedToTPOS.length}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Chưa upload</p>
              <p className="text-2xl font-bold text-orange-600">{itemsNotUploadedToTPOS.length}</p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Lọc sản phẩm:</span>
            <Select value={imageFilter} onValueChange={(value: any) => setImageFilter(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả ({items.length})</SelectItem>
                <SelectItem value="with-images">Có hình ảnh ({itemsWithImages.length})</SelectItem>
                <SelectItem value="without-images">Không có ảnh ({itemsWithoutImages.length})</SelectItem>
                <SelectItem value="uploaded-tpos">Đã upload TPOS ({itemsUploadedToTPOS.length})</SelectItem>
                <SelectItem value="not-uploaded-tpos">Chưa upload TPOS ({itemsNotUploadedToTPOS.length})</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAll}
              className="ml-auto"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Bỏ chọn tất cả
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Chọn tất cả
                </>
              )}
            </Button>
          </div>

          {/* Progress */}
          {isUploading && (
            <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-primary">{currentStep}</span>
                    <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ⏳ Đang xử lý {selectedItems.length} sản phẩm. Vui lòng không đóng cửa sổ này...
              </p>
            </div>
          )}

          {/* Preview Table */}
          <div className="border rounded-lg">
            <div className="p-3 bg-muted border-b">
              <h3 className="font-semibold">
                Danh sách sản phẩm ({filteredItems.length} sản phẩm)
              </h3>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Chọn tất cả"
                      />
                    </TableHead>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Biến thể</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead>Hình ảnh</TableHead>
                    <TableHead>TPOS Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow 
                      key={item.id}
                      className={selectedIds.has(item.id) ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleItem(item.id)}
                          aria-label={`Chọn ${item.product_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.product_code || "AUTO"}
                      </TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>
                        {item.variant && (
                          <Badge variant="secondary">{item.variant}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatVND(item.selling_price || 0)}
                      </TableCell>
                      <TableCell>
                        {item.product_images && item.product_images.length > 0 ? (
                          <Badge variant="default" className="bg-green-600">
                            ✓ {item.product_images.length}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Không có</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.tpos_product_id ? (
                          <Badge variant="default" className="bg-green-600">
                            ✓ ID: {item.tpos_product_id}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Chưa upload</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Hủy
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadExcel}
            disabled={isUploading || selectedItems.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Chỉ tải Excel ({selectedItems.length})
          </Button>
          <Button
            onClick={handleUploadToTPOS}
            disabled={isUploading || selectedItems.length === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload lên TPOS ({selectedItems.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
