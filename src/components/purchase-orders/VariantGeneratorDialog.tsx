import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, AlertTriangle, Search } from "lucide-react";
import { generateAllVariants } from "@/lib/variant-code-generator";
import { TPOS_ATTRIBUTES } from "@/lib/tpos-attributes";

interface VariantGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentItem: {
    product_code: string;
    product_name: string;
  };
  onVariantsGenerated: (variants: Array<{
    fullCode: string;
    variantCode: string;
    productName: string;
    variantText: string;
    hasCollision: boolean;
  }>) => void;
}

export function VariantGeneratorDialog({
  open,
  onOpenChange,
  currentItem,
  onVariantsGenerated
}: VariantGeneratorDialogProps) {
  const [selectedSizeText, setSelectedSizeText] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizeNumber, setSelectedSizeNumber] = useState<string[]>([]);
  const [sizeTextFilter, setSizeTextFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [sizeNumberFilter, setSizeNumberFilter] = useState("");
  const [previewResults, setPreviewResults] = useState<Array<{
    fullCode: string;
    variantCode: string;
    productName: string;
    variantText: string;
    hasCollision: boolean;
  }>>([]);

  // Auto-generate preview on selection change
  useEffect(() => {
    if (!currentItem.product_code || !currentItem.product_name) {
      setPreviewResults([]);
      return;
    }

    if (selectedSizeText.length === 0 && selectedColors.length === 0 && selectedSizeNumber.length === 0) {
      setPreviewResults([]);
      return;
    }

    try {
      const variants = generateAllVariants({
        productCode: currentItem.product_code.trim(),
        productName: currentItem.product_name.trim(),
        sizeTexts: selectedSizeText,
        colors: selectedColors,
        sizeNumbers: selectedSizeNumber
      });

      const formatted = variants.map(v => ({
        fullCode: v.fullCode,
        variantCode: v.variantCode,
        productName: v.productName,
        variantText: v.variantText,
        hasCollision: v.hasCollision
      }));

      setPreviewResults(formatted);
    } catch (error) {
      console.error('Error generating variants:', error);
      setPreviewResults([]);
    }
  }, [selectedSizeText, selectedColors, selectedSizeNumber, currentItem.product_code, currentItem.product_name]);

  const toggleSelection = (type: 'sizeText' | 'color' | 'sizeNumber', value: string) => {
    if (type === 'sizeText') {
      setSelectedSizeText(prev => 
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    } else if (type === 'color') {
      setSelectedColors(prev => 
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    } else {
      setSelectedSizeNumber(prev => 
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    }
  };

  const handleConfirm = () => {
    if (previewResults.length > 0) {
      onVariantsGenerated(previewResults);
      onOpenChange(false);
      // Reset selections and filters
      setSelectedSizeText([]);
      setSelectedColors([]);
      setSelectedSizeNumber([]);
      setSizeTextFilter("");
      setColorFilter("");
      setSizeNumberFilter("");
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset selections and filters
    setSelectedSizeText([]);
    setSelectedColors([]);
    setSelectedSizeNumber([]);
    setSizeTextFilter("");
    setColorFilter("");
    setSizeNumberFilter("");
  };

  // Filter functions
  const filteredSizeText = TPOS_ATTRIBUTES.sizeText.filter(item =>
    item.Name.toLowerCase().includes(sizeTextFilter.toLowerCase())
  );
  
  const filteredColors = TPOS_ATTRIBUTES.color.filter(item =>
    item.Name.toLowerCase().includes(colorFilter.toLowerCase())
  );
  
  const filteredSizeNumber = TPOS_ATTRIBUTES.sizeNumber.filter(item =>
    item.Name.toLowerCase().includes(sizeNumberFilter.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Tạo Biến Thể Tự Động
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Product Info (readonly) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mã Sản Phẩm Gốc</Label>
              <Input value={currentItem.product_code} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Tên Sản Phẩm Gốc</Label>
              <Input value={currentItem.product_name} disabled className="bg-muted" />
            </div>
          </div>

          {/* Selection Columns */}
          <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
            {/* Size Text */}
            <div className="space-y-2 flex flex-col h-full">
              <Label>Size Chữ ({selectedSizeText.length})</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm size chữ..."
                  value={sizeTextFilter}
                  onChange={(e) => setSizeTextFilter(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <ScrollArea className="flex-1 rounded-md border p-3 bg-muted/30 max-h-[400px]">
                <div className="space-y-2">
                  {filteredSizeText.map((item) => (
                    <div 
                      key={item.Id} 
                      className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer"
                    >
                      <Checkbox
                        id={`size-${item.Id}`}
                        checked={selectedSizeText.includes(item.Name)}
                        onCheckedChange={() => toggleSelection('sizeText', item.Name)}
                      />
                      <Label 
                        htmlFor={`size-${item.Id}`} 
                        className="cursor-pointer flex-1 font-normal"
                      >
                        {item.Name}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Color */}
            <div className="space-y-2 flex flex-col h-full">
              <Label>Màu Sắc ({selectedColors.length})</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm màu sắc..."
                  value={colorFilter}
                  onChange={(e) => setColorFilter(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <ScrollArea className="flex-1 rounded-md border p-3 bg-muted/30 max-h-[400px]">
                <div className="space-y-2">
                  {filteredColors.map((item) => (
                    <div 
                      key={item.Id} 
                      className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer"
                    >
                      <Checkbox
                        id={`color-${item.Id}`}
                        checked={selectedColors.includes(item.Name)}
                        onCheckedChange={() => toggleSelection('color', item.Name)}
                      />
                      <Label 
                        htmlFor={`color-${item.Id}`} 
                        className="cursor-pointer flex-1 font-normal"
                      >
                        {item.Name}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Size Number */}
            <div className="space-y-2 flex flex-col h-full">
              <Label>Size Số ({selectedSizeNumber.length})</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm size số..."
                  value={sizeNumberFilter}
                  onChange={(e) => setSizeNumberFilter(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <ScrollArea className="flex-1 rounded-md border p-3 bg-muted/30 max-h-[400px]">
                <div className="space-y-2">
                  {filteredSizeNumber.map((item) => (
                    <div 
                      key={item.Id} 
                      className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer"
                    >
                      <Checkbox
                        id={`num-${item.Id}`}
                        checked={selectedSizeNumber.includes(item.Name)}
                        onCheckedChange={() => toggleSelection('sizeNumber', item.Name)}
                      />
                      <Label 
                        htmlFor={`num-${item.Id}`} 
                        className="cursor-pointer flex-1 font-normal"
                      >
                        {item.Name}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Preview Table */}
          {previewResults.length > 0 && (
            <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between">
                <Label className="text-base">Xem trước kết quả</Label>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {previewResults.length} biến thể
                </Badge>
              </div>
              <div className="border rounded-lg flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="w-32">Mã Đầy Đủ</TableHead>
                        <TableHead className="w-24">Mã Variant</TableHead>
                        <TableHead>Tên Sản Phẩm</TableHead>
                        <TableHead>Chi Tiết Variant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResults.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {result.fullCode}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {result.variantCode}
                              </code>
                              {result.hasCollision && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3" />
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {result.productName}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {result.variantText}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Hủy
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={previewResults.length === 0}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Xác Nhận Tạo {previewResults.length > 0 ? `${previewResults.length} Biến Thể` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
