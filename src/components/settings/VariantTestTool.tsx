import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { detectVariantsFromText } from "@/lib/variant-detector";
import { generateColorCode } from "@/lib/variant-attributes";
import { FlaskConical } from "lucide-react";

export function VariantTestTool() {
  const [productCode, setProductCode] = useState("M800");
  const [colors, setColors] = useState("Hồng, Đỏ, Xanh Đậu");
  const [sizeText, setSizeText] = useState("S, M, L, XL");
  const [sizeNumber, setSizeNumber] = useState("");
  const [results, setResults] = useState<Array<{ variant: string; code: string; fullCode: string }>>([]);

  const handleTest = () => {
    // Parse inputs
    const colorList = colors.split(',').map(v => v.trim()).filter(Boolean);
    const sizeTextList = sizeText.split(',').map(v => v.trim()).filter(Boolean);
    const sizeNumberList = sizeNumber.split(',').map(v => v.trim()).filter(Boolean);

    console.log('🧪 Testing variant combinations:');
    console.log('  Product Code:', productCode);
    console.log('  Colors:', colorList);
    console.log('  Size Text:', sizeTextList);
    console.log('  Size Number:', sizeNumberList);

    // Create cartesian product
    let combinations: Array<{ text: string; parts: { sizeText?: string; color?: string; sizeNumber?: string } }> = [
      { text: '', parts: {} }
    ];

    // Add size text combinations
    if (sizeTextList.length > 0) {
      const newCombinations: typeof combinations = [];
      for (const base of combinations) {
        for (const size of sizeTextList) {
          newCombinations.push({
            text: base.text ? `${base.text}, ${size}` : size,
            parts: { ...base.parts, sizeText: size }
          });
        }
      }
      combinations = newCombinations;
    }

    // Add color combinations
    if (colorList.length > 0) {
      const newCombinations: typeof combinations = [];
      for (const base of combinations) {
        for (const color of colorList) {
          newCombinations.push({
            text: base.text ? `${base.text}, ${color}` : color,
            parts: { ...base.parts, color }
          });
        }
      }
      combinations = newCombinations;
    }

    // Add size number combinations
    if (sizeNumberList.length > 0) {
      const newCombinations: typeof combinations = [];
      for (const base of combinations) {
        for (const sizeNum of sizeNumberList) {
          newCombinations.push({
            text: base.text ? `${base.text}, ${sizeNum}` : sizeNum,
            parts: { ...base.parts, sizeNumber: sizeNum }
          });
        }
      }
      combinations = newCombinations;
    }

    console.log(`  Total combinations: ${combinations.length}`);

    // Helper function to normalize Vietnamese text (remove diacritics)
    const normalizeVietnamese = (text: string): string => {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };

    // Generate product codes for each combination
    const usedColorCodes = new Map<string, number>(); // Track color codes and their usage count
    const generatedResults = combinations.map(combo => {
      let variantCode = '';

      // Build code: Size Text + Color + Size Number
      if (combo.parts.sizeText) {
        // Normalize and take first letter of each word, then take only the first character
        const normalized = normalizeVietnamese(combo.parts.sizeText);
        const words = normalized.split(/\s+/);
        const firstLetters = words.map(w => w.charAt(0).toUpperCase()).join('');
        variantCode += firstLetters.charAt(0);
      }

      if (combo.parts.color) {
        // Normalize and take first letter of each word in color name
        const normalized = normalizeVietnamese(combo.parts.color);
        const colorWords = normalized.split(/\s+/);
        const baseColorCode = colorWords.map(w => w.charAt(0).toUpperCase()).join('');
        
        // Handle duplicates by tracking color code usage
        const currentCount = usedColorCodes.get(baseColorCode) || 0;
        const finalColorCode = currentCount === 0 ? baseColorCode : baseColorCode + currentCount;
        usedColorCodes.set(baseColorCode, currentCount + 1);
        
        variantCode += finalColorCode;
      }

      if (combo.parts.sizeNumber) {
        // If root code ends with number and we only have numeric size, add 'A' prefix
        if (/\d$/.test(productCode) && !combo.parts.color && !combo.parts.sizeText) {
          variantCode += `A${combo.parts.sizeNumber}`;
        } else {
          variantCode += combo.parts.sizeNumber;
        }
      }

      // Fallback if no detection
      if (!variantCode && combo.text) {
        const normalized = normalizeVietnamese(combo.text);
        const words = normalized.split(/\s+/);
        variantCode = words.map(w => w.charAt(0).toUpperCase()).join('');
      }

      const fullCode = `${productCode}${variantCode}`;

      console.log(`  ${fullCode} = ${productCode} + ${variantCode} (${combo.text})`);

      return {
        variant: combo.text,
        code: variantCode,
        fullCode
      };
    });

    setResults(generatedResults);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Test Trộn Biến Thể
        </CardTitle>
        <CardDescription>
          Kiểm tra cách hệ thống tạo mã sản phẩm từ các biến thể
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
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
            <Label htmlFor="size-text">Size Chữ (phân cách bằng dấu phẩy)</Label>
            <Input
              id="size-text"
              value={sizeText}
              onChange={(e) => setSizeText(e.target.value)}
              placeholder="Ví dụ: S, M, L, XL"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="colors">Màu Sắc (phân cách bằng dấu phẩy)</Label>
            <Input
              id="colors"
              value={colors}
              onChange={(e) => setColors(e.target.value)}
              placeholder="Ví dụ: Hồng, Đỏ, Xanh Đậu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="size-number">Size Số (phân cách bằng dấu phẩy)</Label>
            <Input
              id="size-number"
              value={sizeNumber}
              onChange={(e) => setSizeNumber(e.target.value)}
              placeholder="Ví dụ: 36, 38, 40"
            />
          </div>

          <Button onClick={handleTest} className="w-full">
            <FlaskConical className="mr-2 h-4 w-4" />
            Tạo Kết Quả
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Kết Quả</h3>
              <Badge variant="secondary">{results.length} biến thể</Badge>
            </div>
            
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Mã Sản Phẩm</TableHead>
                    <TableHead>Mã Biến Thể</TableHead>
                    <TableHead>Tên Biến Thể</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {result.fullCode}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {result.code}
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.variant}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
