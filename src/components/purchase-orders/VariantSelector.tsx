import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { X } from "lucide-react";
import { COLORS, TEXT_SIZES, NUMBER_SIZES } from "@/lib/variant-attributes";

interface VariantSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function VariantSelector({ value, onChange }: VariantSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);

  // Sync with external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || "");
    }
  }, [value]);

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleSelect = (selectedValue: string) => {
    const currentParts = inputValue
      .split(" + ")
      .map((p) => p.trim())
      .filter(Boolean);

    // If attribute already exists, don't add it again
    if (!currentParts.includes(selectedValue)) {
      const newValue =
        currentParts.length > 0
          ? `${inputValue} + ${selectedValue}`
          : selectedValue;
      setInputValue(newValue);
      onChange(newValue);
    }
    setOpen(false);
  };

  const removeAttribute = (index: number) => {
    const parts = inputValue.split(" + ").filter((_, i) => i !== index);
    const newValue = parts.join(" + ");
    setInputValue(newValue);
    onChange(newValue);
  };

  const clearAll = () => {
    setInputValue("");
    onChange("");
  };

  // Filter suggestions based on current input
  const searchTerm = inputValue.split(" + ").pop()?.trim().toLowerCase() || "";
  const filteredColors = COLORS.filter((color) =>
    color.toLowerCase().includes(searchTerm)
  ).slice(0, 10);
  const filteredTextSizes = TEXT_SIZES.filter((size) =>
    size.toLowerCase().includes(searchTerm)
  );
  const filteredNumberSizes = NUMBER_SIZES.filter((size) =>
    size.includes(searchTerm)
  ).slice(0, 10);

  const hasResults =
    filteredColors.length > 0 ||
    filteredTextSizes.length > 0 ||
    filteredNumberSizes.length > 0;

  const selectedParts = inputValue
    .split(" + ")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => {
                handleInputChange(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Nhập biến thể (ví dụ: Đỏ + L hoặc Xanh + 36)"
              className="pr-10"
            />
            {inputValue && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={clearAll}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] max-w-[400px]"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandInput placeholder="Tìm kiếm..." />
            <CommandList>
              {!hasResults && <CommandEmpty>Không tìm thấy biến thể</CommandEmpty>}

              {filteredColors.length > 0 && (
                <CommandGroup heading="🎨 Màu sắc">
                  {filteredColors.map((color) => (
                    <CommandItem key={color} onSelect={() => handleSelect(color)}>
                      {color}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredTextSizes.length > 0 && (
                <CommandGroup heading="📏 Size chữ">
                  {filteredTextSizes.map((size) => (
                    <CommandItem key={size} onSelect={() => handleSelect(size)}>
                      {size}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredNumberSizes.length > 0 && (
                <CommandGroup heading="🔢 Size số">
                  {filteredNumberSizes.map((size) => (
                    <CommandItem key={size} onSelect={() => handleSelect(size)}>
                      {size}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Display selected attributes as badges */}
      {selectedParts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedParts.map((part, idx) => (
            <Badge key={idx} variant="secondary" className="gap-1">
              {part}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeAttribute(idx)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
