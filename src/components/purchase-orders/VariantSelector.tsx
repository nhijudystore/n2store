import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  // Sync with external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || "");
    }
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
    onChange(selectedValue);
    setOpen(false);
    setSearchTerm("");
  };

  const clearAll = () => {
    setInputValue("");
    onChange("");
  };

  // Filter suggestions based on search term
  const searchLower = searchTerm.toLowerCase();
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
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={inputValue}
              readOnly
              onFocus={() => setOpen(true)}
              placeholder="Chọn biến thể"
              className="pr-10 cursor-pointer"
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
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Tìm kiếm..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
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
