import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { X, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { COLORS, TEXT_SIZES, NUMBER_SIZES } from "@/lib/variant-attributes";
import { cn } from "@/lib/utils";

interface VariantSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Prepare all available variants with categories
const allVariants = [
  ...COLORS.map(c => ({ label: c, category: 'Màu' })),
  ...TEXT_SIZES.map(s => ({ label: s, category: 'Size chữ' })),
  ...NUMBER_SIZES.map(n => ({ label: n, category: 'Size số' }))
];

export function VariantSelector({ value, onChange, className }: VariantSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse value string to array of selected variants
  const selectedVariants = value
    ? value.split(',').map(v => v.trim()).filter(Boolean)
    : [];

  // Update parent with joined string
  const updateSelection = (variants: string[]) => {
    const uniqueVariants = Array.from(new Set(variants.filter(Boolean)));
    onChange(uniqueVariants.join(', '));
  };

  const addVariant = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !selectedVariants.includes(trimmed)) {
      updateSelection([...selectedVariants, trimmed]);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addVariant();
    } else if (e.key === ',' && inputValue.trim()) {
      e.preventDefault();
      addVariant();
    } else if (e.key === 'Backspace' && !inputValue && selectedVariants.length > 0) {
      // Remove last variant when backspace on empty input
      const newVariants = [...selectedVariants];
      newVariants.pop();
      updateSelection(newVariants);
    }
  };

  const removeVariant = (variantToRemove: string) => {
    updateSelection(selectedVariants.filter(v => v !== variantToRemove));
  };

  const toggleVariant = (variant: string) => {
    if (selectedVariants.includes(variant)) {
      removeVariant(variant);
    } else {
      updateSelection([...selectedVariants, variant]);
    }
    
    // Clear input and refocus for continuous selection
    setInputValue("");
    setSearchValue("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // Maintain focus when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Filter variants based on search
  const filterVariants = (variants: typeof allVariants) => {
    if (!searchValue) return variants;
    
    const search = searchValue.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    return variants.filter(v => {
      const label = v.label.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return label.includes(search);
    });
  };

  // Group filtered variants by category
  const filteredVariants = filterVariants(allVariants);
  const groupedVariants = {
    'Màu': filteredVariants.filter(v => v.category === 'Màu'),
    'Size chữ': filteredVariants.filter(v => v.category === 'Size chữ'),
    'Size số': filteredVariants.filter(v => v.category === 'Size số'),
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <div className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex flex-wrap gap-1 items-center cursor-text">
            {selectedVariants.map((variant, index) => (
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
            ))}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setSearchValue(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onBlur={addVariant}
              onFocus={() => setOpen(true)}
              placeholder={selectedVariants.length === 0 ? "Nhập biến thể (Enter hoặc dấu phẩy để thêm)" : ""}
              className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Tìm kiếm biến thể..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>Không tìm thấy biến thể.</CommandEmpty>
            
            {groupedVariants['Màu'].length > 0 && (
              <CommandGroup heading="Màu">
                {groupedVariants['Màu'].map((variant) => (
                  <CommandItem
                    key={variant.label}
                    value={variant.label}
                    onSelect={() => {
                      toggleVariant(variant.label);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedVariants.includes(variant.label) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {variant.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {groupedVariants['Size chữ'].length > 0 && (
              <CommandGroup heading="Size chữ">
                {groupedVariants['Size chữ'].map((variant) => (
                  <CommandItem
                    key={variant.label}
                    value={variant.label}
                    onSelect={() => {
                      toggleVariant(variant.label);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedVariants.includes(variant.label) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {variant.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {groupedVariants['Size số'].length > 0 && (
              <CommandGroup heading="Size số">
                {groupedVariants['Size số'].map((variant) => (
                  <CommandItem
                    key={variant.label}
                    value={variant.label}
                    onSelect={() => {
                      toggleVariant(variant.label);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedVariants.includes(variant.label) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {variant.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
