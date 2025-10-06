import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { X, Check } from "lucide-react";
import { COLORS, TEXT_SIZES, NUMBER_SIZES } from "@/lib/variant-attributes";
import { cn } from "@/lib/utils";

interface VariantSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function VariantSelector({ value, onChange, className }: VariantSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  // Parse value string to array of selected variants
  const selectedVariants = value
    ? value.split(',').map(v => v.trim()).filter(Boolean)
    : [];

  // Update parent with joined string
  const updateSelection = (variants: string[]) => {
    const uniqueVariants = Array.from(new Set(variants.filter(Boolean)));
    onChange(uniqueVariants.join(', '));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value && !open) {
      setOpen(true);
    }
  };

  const handleSelect = (selectedValue: string) => {
    // Toggle selection: add if not present, remove if present
    const isSelected = selectedVariants.includes(selectedValue);
    const newVariants = isSelected
      ? selectedVariants.filter(v => v !== selectedValue)
      : [...selectedVariants, selectedValue];
    
    updateSelection(newVariants);
    setSearchTerm("");
    // Keep popover open for multiple selections
  };

  const removeVariant = (variantToRemove: string) => {
    updateSelection(selectedVariants.filter(v => v !== variantToRemove));
  };

  const clearAll = () => {
    updateSelection([]);
    setSearchTerm("");
    setOpen(false);
  };

  // Filter suggestions based on search term
  const searchLower = searchTerm.toLowerCase();
  const filteredColors = searchTerm 
    ? COLORS.filter((color) => color.toLowerCase().includes(searchLower)).slice(0, 10)
    : COLORS.slice(0, 10);
  const filteredTextSizes = searchTerm
    ? TEXT_SIZES.filter((size) => size.toLowerCase().includes(searchLower))
    : TEXT_SIZES;
  const filteredNumberSizes = searchTerm
    ? NUMBER_SIZES.filter((size) => size.toLowerCase().includes(searchLower)).slice(0, 10)
    : NUMBER_SIZES.slice(0, 10);

  const hasResults =
    filteredColors.length > 0 ||
    filteredTextSizes.length > 0 ||
    filteredNumberSizes.length > 0;

  return (
    <div className={className || "relative"}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <div 
              className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer flex flex-wrap gap-1 items-center"
              onClick={() => setOpen(true)}
            >
              {selectedVariants.length > 0 ? (
                selectedVariants.map((variant, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    <span>{variant}</span>
                    <button
                      type="button"
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeVariant(variant);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Chọn biến thể</span>
              )}
              {selectedVariants.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                >
                  Xóa tất cả
                </Button>
              )}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] max-w-[400px]"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={() => {
            setSearchTerm("");
          }}
        >
          <Command shouldFilter={false}>
            <div className="border-b px-3 py-2">
              <Input
                value={searchTerm}
                onChange={handleInputChange}
                placeholder="🔍 Tìm kiếm..."
                className="h-9"
                autoFocus
              />
            </div>
            <CommandList>
              {!hasResults && <CommandEmpty>Không tìm thấy biến thể</CommandEmpty>}

              {filteredColors.length > 0 && (
                <CommandGroup heading="🎨 Màu sắc">
                  {filteredColors.map((color) => {
                    const isSelected = selectedVariants.includes(color);
                    return (
                      <CommandItem key={color} onSelect={() => handleSelect(color)}>
                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50")}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        {color}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {filteredTextSizes.length > 0 && (
                <CommandGroup heading="📏 Size chữ">
                  {filteredTextSizes.map((size) => {
                    const isSelected = selectedVariants.includes(size);
                    return (
                      <CommandItem key={size} onSelect={() => handleSelect(size)}>
                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50")}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        {size}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {filteredNumberSizes.length > 0 && (
                <CommandGroup heading="🔢 Size số">
                  {filteredNumberSizes.map((size) => {
                    const isSelected = selectedVariants.includes(size);
                    return (
                      <CommandItem key={size} onSelect={() => handleSelect(size)}>
                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50")}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        {size}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
