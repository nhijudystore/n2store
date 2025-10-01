import { toast } from "sonner";

export const generateOrderImage = async (
  imageUrl: string,
  variant: string,
  quantity: number,
  productName: string
): Promise<void> => {
  try {
    // Create a canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    // Load the image
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Set canvas dimensions (image + space for text)
    const padding = 40;
    const textHeight = 80;
    canvas.width = img.width;
    canvas.height = img.height + textHeight + padding;

    // Fill background with white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image
    ctx.drawImage(img, 0, 0);

    // Prepare text
    const variantText = variant || "Không có biến thể";
    const text = `${variantText} - SL: ${quantity}`;
    
    // Draw text background
    const textY = img.height + padding / 2;
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, img.height, canvas.width, textHeight + padding);

    // Draw text
    ctx.fillStyle = "#000000";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, textY + textHeight / 2);

    // Convert to blob and copy to clipboard
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create blob"));
      }, "image/png");
    });

    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);

    toast.success("Đã copy hình order vào clipboard!");
  } catch (error) {
    console.error("Error generating order image:", error);
    toast.error("Không thể tạo hình order. Vui lòng thử lại.");
  }
};
