import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadCellProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  itemIndex: number;
}

export function ImageUploadCell({ images, onImagesChange, itemIndex }: ImageUploadCellProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const cellRef = useRef<HTMLDivElement>(null);

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file hình ảnh",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Lỗi", 
        description: "Kích thước file phải nhỏ hơn 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `purchase-order-items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('purchase-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('purchase-images')
        .getPublicUrl(filePath);

      onImagesChange([...images, publicUrl]);
      
      toast({
        title: "Thành công",
        description: "Đã tải ảnh lên thành công"
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Lỗi tải ảnh",
        description: "Không thể tải ảnh lên. Vui lòng thử lại.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  }, [images, onImagesChange, toast]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!cellRef.current?.contains(e.target as Node)) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadImage(file);
        }
        break;
      }
    }
  }, [uploadImage]);

  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  }, [images, onImagesChange]);

  // Add paste event listener
  useState(() => {
    const handlePasteEvent = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', handlePasteEvent);
    return () => document.removeEventListener('paste', handlePasteEvent);
  });

  return (
    <div 
      ref={cellRef}
      className="flex flex-col gap-2 min-h-[60px] p-2"
      tabIndex={0}
    >
      {/* Image previews */}
      <div className="flex flex-wrap gap-1">
        {images.map((imageUrl, index) => (
          <div key={index} className="relative group">
            <img 
              src={imageUrl} 
              alt={`Product ${itemIndex + 1} - Image ${index + 1}`}
              className="w-12 h-12 object-cover rounded border"
            />
            <Button
              size="sm"
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeImage(index)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Upload area */}
      <div className="flex items-center justify-center">
        {isUploading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang tải...</span>
          </div>
        ) : (
          <div className="text-center">
            <div className="flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ctrl+V để dán ảnh
            </p>
          </div>
        )}
      </div>
    </div>
  );
}