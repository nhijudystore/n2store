import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { COLORS, TEXT_SIZES, NUMBER_SIZES } from "@/lib/variant-attributes";

interface VariantSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function VariantSelector({ value, onChange }: VariantSelectorProps) {
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedTextSize, setSelectedTextSize] = useState<string>("");
  const [selectedNumberSize, setSelectedNumberSize] = useState<string>("");
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  // Parse existing value when component mounts or value changes externally
  useEffect(() => {
    if (!value) {
      setSelectedColor("");
      setSelectedTextSize("");
      setSelectedNumberSize("");
      setCustomValue("");
      setUseCustomInput(false);
      return;
    }

    // Check if value can be parsed from our predefined options
    const parts = value.split(" + ").map(p => p.trim());
    let foundColor = "";
    let foundTextSize = "";
    let foundNumberSize = "";

    parts.forEach(part => {
      if (COLORS.includes(part as any)) {
        foundColor = part;
      } else if (TEXT_SIZES.includes(part as any)) {
        foundTextSize = part;
      } else if (NUMBER_SIZES.includes(part as any)) {
        foundNumberSize = part;
      }
    });

    // If we found any matching attributes, use selector mode
    if (foundColor || foundTextSize || foundNumberSize) {
      setSelectedColor(foundColor);
      setSelectedTextSize(foundTextSize);
      setSelectedNumberSize(foundNumberSize);
      setUseCustomInput(false);
      setCustomValue("");
    } else {
      // Otherwise, use custom input mode
      setUseCustomInput(true);
      setCustomValue(value);
      setSelectedColor("");
      setSelectedTextSize("");
      setSelectedNumberSize("");
    }
  }, [value]);

  // Update parent when selections change
  useEffect(() => {
    if (useCustomInput) {
      onChange(customValue);
      return;
    }

    const attributes = [selectedColor, selectedTextSize, selectedNumberSize].filter(Boolean);
    const newValue = attributes.join(" + ");
    
    // Only update if value actually changed to avoid loops
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [selectedColor, selectedTextSize, selectedNumberSize, useCustomInput, customValue]);

  const clearAll = () => {
    setSelectedColor("");
    setSelectedTextSize("");
    setSelectedNumberSize("");
    setCustomValue("");
    onChange("");
  };

  const removeAttribute = (type: "color" | "textSize" | "numberSize") => {
    if (type === "color") setSelectedColor("");
    if (type === "textSize") setSelectedTextSize("");
    if (type === "numberSize") setSelectedNumberSize("");
  };

  const toggleMode = () => {
    if (useCustomInput) {
      // Switching to selector mode - clear custom value
      setCustomValue("");
      setUseCustomInput(false);
    } else {
      // Switching to custom mode - combine current selections as starting value
      const attributes = [selectedColor, selectedTextSize, selectedNumberSize].filter(Boolean);
      setCustomValue(attributes.join(" + "));
      setSelectedColor("");
      setSelectedTextSize("");
      setSelectedNumberSize("");
      setUseCustomInput(true);
    }
  };

  if (useCustomInput) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Nhập biến thể tự do"
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={toggleMode}
            className="whitespace-nowrap"
          >
            Chọn từ danh sách
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Display selected attributes as badges */}
      {(selectedColor || selectedTextSize || selectedNumberSize) && (
        <div className="flex flex-wrap gap-2">
          {selectedColor && (
            <Badge variant="secondary" className="gap-1">
              {selectedColor}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeAttribute("color")}
              />
            </Badge>
          )}
          {selectedTextSize && (
            <Badge variant="secondary" className="gap-1">
              {selectedTextSize}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeAttribute("textSize")}
              />
            </Badge>
          )}
          {selectedNumberSize && (
            <Badge variant="secondary" className="gap-1">
              {selectedNumberSize}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeAttribute("numberSize")}
              />
            </Badge>
          )}
        </div>
      )}

      {/* Attribute selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Màu sắc</Label>
          <Select value={selectedColor} onValueChange={setSelectedColor}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Chọn màu" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {COLORS.map((color) => (
                <SelectItem key={color} value={color}>
                  {color}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Size chữ</Label>
          <Select value={selectedTextSize} onValueChange={setSelectedTextSize}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Chọn size" />
            </SelectTrigger>
            <SelectContent>
              {TEXT_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Size số</Label>
          <Select value={selectedNumberSize} onValueChange={setSelectedNumberSize}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Chọn size" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {NUMBER_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={clearAll}
          className="text-xs"
          disabled={!selectedColor && !selectedTextSize && !selectedNumberSize}
        >
          Xóa tất cả
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={toggleMode}
          className="text-xs"
        >
          Nhập tự do
        </Button>
      </div>
    </div>
  );
}
