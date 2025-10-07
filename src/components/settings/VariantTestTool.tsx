import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FlaskConical, AlertTriangle } from "lucide-react";
import { generateAllVariants } from "@/lib/variant-code-generator";

// TPOS Attributes from TPOS system
const TPOS_ATTRIBUTES = {
  sizeText: [
    { Id: 5, Name: "Free Size" },
    { Id: 1, Name: "S" },
    { Id: 2, Name: "M" },
    { Id: 3, Name: "L" },
    { Id: 4, Name: "XL" },
    { Id: 31, Name: "XXL" },
    { Id: 32, Name: "XXXL" }
  ],
  sizeNumber: [
    { Id: 80, Name: "27" }, { Id: 81, Name: "28" }, { Id: 18, Name: "29" }, { Id: 19, Name: "30" },
    { Id: 20, Name: "31" }, { Id: 21, Name: "32" }, { Id: 46, Name: "34" }, { Id: 33, Name: "35" },
    { Id: 34, Name: "36" }, { Id: 35, Name: "37" }, { Id: 36, Name: "38" }, { Id: 37, Name: "39" },
    { Id: 44, Name: "40" }, { Id: 91, Name: "41" }, { Id: 92, Name: "42" }, { Id: 93, Name: "43" },
    { Id: 94, Name: "44" }, { Id: 22, Name: "1" }, { Id: 23, Name: "2" }, { Id: 24, Name: "3" },
    { Id: 48, Name: "4" }
  ],
  color: [
    { Id: 6, Name: "Trắng" }, { Id: 7, Name: "Đen" }, { Id: 8, Name: "Đỏ" }, { Id: 9, Name: "Vàng" },
    { Id: 10, Name: "Cam" }, { Id: 11, Name: "Xám" }, { Id: 12, Name: "Hồng" }, { Id: 14, Name: "Nude" },
    { Id: 15, Name: "Nâu" }, { Id: 16, Name: "Rêu" }, { Id: 17, Name: "Xanh" }, { Id: 25, Name: "Bạc" },
    { Id: 26, Name: "Tím" }, { Id: 27, Name: "Xanh Min" }, { Id: 28, Name: "Trắng Kem" }, { Id: 29, Name: "Xanh Lá" },
    { Id: 38, Name: "Cổ Vịt" }, { Id: 40, Name: "Xanh Đậu" }, { Id: 42, Name: "Tím Môn" }, { Id: 43, Name: "Muối Tiêu" },
    { Id: 45, Name: "Kem" }, { Id: 47, Name: "Hồng Đậm" }, { Id: 49, Name: "Ghi" }, { Id: 50, Name: "Xanh Mạ" },
    { Id: 51, Name: "Vàng Đồng" }, { Id: 52, Name: "Xanh Bơ" }, { Id: 53, Name: "Xanh Đen" }, { Id: 54, Name: "Xanh CoBan" },
    { Id: 55, Name: "Xám Đậm" }, { Id: 56, Name: "Xám Nhạt" }, { Id: 57, Name: "Xanh Dương" }, { Id: 58, Name: "Cam Sữa" },
    { Id: 59, Name: "Hồng Nhạt" }, { Id: 60, Name: "Đậm" }, { Id: 61, Name: "Nhạt" }, { Id: 62, Name: "Xám Khói" },
    { Id: 63, Name: "Xám Chuột" }, { Id: 64, Name: "Xám Đen" }, { Id: 65, Name: "Xám Trắng" }, { Id: 66, Name: "Xanh Đậm" },
    { Id: 67, Name: "Sọc Đen" }, { Id: 68, Name: "Sọc Trắng" }, { Id: 69, Name: "Sọc Xám" }, { Id: 70, Name: "Jean Trắng" },
    { Id: 71, Name: "Jean Xanh" }, { Id: 72, Name: "Cam Đất" }, { Id: 73, Name: "Nâu Đậm" }, { Id: 74, Name: "Nâu Nhạt" },
    { Id: 75, Name: "Đỏ Tươi" }, { Id: 76, Name: "Đen Vàng" }, { Id: 77, Name: "Cà Phê" }, { Id: 78, Name: "Đen Bạc" },
    { Id: 79, Name: "Bò" }, { Id: 82, Name: "Sọc Xanh" }, { Id: 83, Name: "Xanh Rêu" }, { Id: 84, Name: "Hồng Ruốc" },
    { Id: 85, Name: "Hồng Dâu" }, { Id: 86, Name: "Xanh Nhạt" }, { Id: 87, Name: "Xanh Ngọc" }, { Id: 88, Name: "Caro" },
    { Id: 89, Name: "Sọc Hồng" }, { Id: 90, Name: "Trong" }, { Id: 95, Name: "Trắng Hồng" }, { Id: 96, Name: "Trắng Sáng" },
    { Id: 97, Name: "Đỏ Đô" }, { Id: 98, Name: "Cam Đào" }, { Id: 99, Name: "Cam Lạnh" }, { Id: 100, Name: "Hồng Đào" },
    { Id: 101, Name: "Hồng Đất" }, { Id: 102, Name: "Tím Đậm" }
  ]
};

const DEFAULT_SELECTIONS = {
  sizeText: ["M", "L", "XL", "XXL", "XXXL"],
  color: ["Cam", "Xanh Đậu", "Xanh Đen"],
  sizeNumber: ["29", "30", "32"]
};

export function VariantTestTool() {
  const [productCode, setProductCode] = useState("M800");
  const [productName, setProductName] = useState("Áo Thun");
  const [selectedSizeText, setSelectedSizeText] = useState<string[]>(DEFAULT_SELECTIONS.sizeText);
  const [selectedColors, setSelectedColors] = useState<string[]>(DEFAULT_SELECTIONS.color);
  const [selectedSizeNumber, setSelectedSizeNumber] = useState<string[]>(DEFAULT_SELECTIONS.sizeNumber);
  const [results, setResults] = useState<Array<{
    variant: string;
    code: string;
    fullCode: string;
    productName: string;
    hasCollision: boolean;
  }>>([]);

  // Auto-generate on load
  useEffect(() => {
    handleTest();
  }, []);

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

  const handleTest = () => {
    if (!productCode.trim()) {
      return;
    }

    if (!productName.trim()) {
      return;
    }

    if (selectedSizeText.length === 0 && selectedColors.length === 0 && selectedSizeNumber.length === 0) {
      return;
    }

    try {
      // Use the standard generator
      const generatedVariants = generateAllVariants({
        productCode: productCode.trim(),
        productName: productName.trim(),
        sizeTexts: selectedSizeText,
        colors: selectedColors,
        sizeNumbers: selectedSizeNumber
      });

      const formattedResults = generatedVariants.map(v => ({
        variant: v.variantText,
        code: v.variantCode,
        fullCode: v.fullCode,
        productName: v.productName,
        hasCollision: v.hasCollision
      }));

      setResults(formattedResults);
    } catch (error) {
      console.error('Error generating variants:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Test Trộn Biến Thể
        </CardTitle>
        <CardDescription>
          Tạo mã variant tự động với logic: Size Chữ (chữ cái đầu) + Màu (chữ cái đầu mỗi từ) + Size Số
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="product-code">Mã Sản Phẩm Gốc</Label>
            <Input
              id="product-code"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="Ví dụ: M800, TEST"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-name">Tên Sản Phẩm Gốc</Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ví dụ: Áo Thun"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Size Text Selection */}
          <div className="space-y-2">
            <Label>Size Chữ ({selectedSizeText.length} đã chọn)</Label>
            <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                {TPOS_ATTRIBUTES.sizeText.map((item) => (
                  <div key={item.Id} className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer" onClick={() => toggleSelection('sizeText', item.Name)}>
                    <Checkbox
                      id={`size-${item.Id}`}
                      checked={selectedSizeText.includes(item.Name)}
                      onCheckedChange={() => toggleSelection('sizeText', item.Name)}
                    />
                    <Label htmlFor={`size-${item.Id}`} className="cursor-pointer flex-1 font-normal">
                      {item.Name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>Màu Sắc ({selectedColors.length} đã chọn)</Label>
            <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                {TPOS_ATTRIBUTES.color.map((item) => (
                  <div key={item.Id} className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer" onClick={() => toggleSelection('color', item.Name)}>
                    <Checkbox
                      id={`color-${item.Id}`}
                      checked={selectedColors.includes(item.Name)}
                      onCheckedChange={() => toggleSelection('color', item.Name)}
                    />
                    <Label htmlFor={`color-${item.Id}`} className="cursor-pointer flex-1 font-normal">
                      {item.Name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Size Number Selection */}
          <div className="space-y-2">
            <Label>Size Số ({selectedSizeNumber.length} đã chọn)</Label>
            <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                {TPOS_ATTRIBUTES.sizeNumber.map((item) => (
                  <div key={item.Id} className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer" onClick={() => toggleSelection('sizeNumber', item.Name)}>
                    <Checkbox
                      id={`num-${item.Id}`}
                      checked={selectedSizeNumber.includes(item.Name)}
                      onCheckedChange={() => toggleSelection('sizeNumber', item.Name)}
                    />
                    <Label htmlFor={`num-${item.Id}`} className="cursor-pointer flex-1 font-normal">
                      {item.Name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Button onClick={handleTest} className="w-full">
          <FlaskConical className="mr-2 h-4 w-4" />
          Tạo Kết Quả
        </Button>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Kết Quả</h3>
              <Badge variant="secondary">{results.length} biến thể</Badge>
            </div>
            
            <div className="border rounded-lg">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-32">Mã Đầy Đủ</TableHead>
                      <TableHead className="w-28">Mã Variant</TableHead>
                      <TableHead>Tên Sản Phẩm</TableHead>
                      <TableHead>Chi Tiết Variant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {result.fullCode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {result.code}
                            </code>
                            {result.hasCollision && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Collision
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {result.productName}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {result.variant}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
