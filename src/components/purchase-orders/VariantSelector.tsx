import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { X } from "lucide-react";
import { COLORS, TEXT_SIZES, NUMBER_SIZES } from "@/lib/variant-attributes";

interface VariantSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function VariantSelector({ value, onChange }: VariantSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  // Sync with external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || "");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    // Chỉ mở popover khi bắt đầu gõ (có giá trị)
    if (value && !open) {
      setOpen(true);
    }
  };

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
    onChange(selectedValue);
    setSearchTerm("");
    setOpen(false);
  };

  const clearAll = () => {
    setInputValue("");
    setSearchTerm("");
    onChange("");
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
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={open ? searchTerm : inputValue}
              onChange={handleInputChange}
              onClick={() => setOpen(true)}
              placeholder="Chọn biến thể"
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
          onInteractOutside={() => {
            setSearchTerm("");
            setOpen(false);
          }}
        >
          <Command shouldFilter={false}>
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
    </div>
  );
}
