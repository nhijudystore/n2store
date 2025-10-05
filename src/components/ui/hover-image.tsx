import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HoverImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback?: React.ReactNode;
  hoverScale?: number;
}

/**
 * Reusable image component with hover zoom effect
 * Used across the app for consistent image interactions
 */
export function HoverImage({
  src,
  alt,
  className,
  containerClassName,
  fallback,
  hoverScale = 12,
}: HoverImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded", containerClassName)}>
        {fallback || <ImageIcon className="h-4 w-4 text-muted-foreground" />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "object-cover rounded cursor-pointer transition-transform duration-200 relative",
        `hover:scale-[${hoverScale}] hover:z-20`,
        className
      )}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

interface HoverImageGroupProps {
  images: string[];
  altPrefix: string;
  className?: string;
  containerClassName?: string;
  hoverScale?: number;
}

/**
 * Component for displaying multiple images with hover zoom effect
 */
export function HoverImageGroup({
  images,
  altPrefix,
  className,
  containerClassName,
  hoverScale = 12,
}: HoverImageGroupProps) {
  if (!images || images.length === 0) {
    return <span className="text-xs text-muted-foreground">Chưa có hình</span>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", containerClassName)}>
      {images.map((imageUrl, index) => (
        <HoverImage
          key={index}
          src={imageUrl}
          alt={`${altPrefix} ${index + 1}`}
          className={cn("w-8 h-8 border", className)}
          hoverScale={hoverScale}
        />
      ))}
    </div>
  );
}
