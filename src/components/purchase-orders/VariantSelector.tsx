import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { COLORS, TEXT_SIZES, NUMBER_SIZES } from "@/lib/variant-attributes";

interface VariantSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function VariantSelector({ value, onChange, className }: VariantSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (selectedValue: string) => {
    // Thêm thuộc tính vào variant text hiện tại
    const currentValue = value.trim();
    const newValue = currentValue 
      ? `${currentValue}, ${selectedValue}` 
      : selectedValue;
    onChange(newValue);
    setOpen(false);
  };

  // Filter suggestions based on current value
  const searchLower = value.toLowerCase();
  const filteredColors = COLORS.filter((color) => 
    color.toLowerCase().includes(searchLower)
  ).slice(0, 10);
  const filteredTextSizes = TEXT_SIZES.filter((size) => 
    size.toLowerCase().includes(searchLower)
  );
  const filteredNumberSizes = NUMBER_SIZES.filter((size) => 
    size.toLowerCase().includes(searchLower)
  ).slice(0, 10);

  const hasResults =
    filteredColors.length > 0 ||
    filteredTextSizes.length > 0 ||
    filteredNumberSizes.length > 0;

  return (
    <div className={className || "relative"}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Nhập biến thể (VD: XL, Trắng)"
            className="border-0 shadow-none focus-visible:ring-0 p-2"
          />
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] max-w-[400px]"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {!hasResults && <CommandEmpty>Không tìm thấy gợi ý</CommandEmpty>}

              {filteredTextSizes.length > 0 && (
                <CommandGroup heading="📏 Size chữ">
                  {filteredTextSizes.map((size) => (
                    <CommandItem key={size} onSelect={() => handleSelect(size)}>
                      {size}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredColors.length > 0 && (
                <CommandGroup heading="🎨 Màu sắc">
                  {filteredColors.map((color) => (
                    <CommandItem key={color} onSelect={() => handleSelect(color)}>
                      {color}
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
    </div>
  );
}
