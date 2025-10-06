import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface VariantSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function VariantSelector({ value, onChange, className }: VariantSelectorProps) {
  const [inputValue, setInputValue] = useState("");

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

  return (
    <div className={className || "relative"}>
      <div className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex flex-wrap gap-1 items-center">
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
              onClick={() => removeVariant(variant)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addVariant}
          placeholder={selectedVariants.length === 0 ? "Nhập biến thể (Enter hoặc dấu phẩy để thêm)" : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
