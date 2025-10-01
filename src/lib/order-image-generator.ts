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

    // Calculate dimensions: image takes 65%, text takes 35%
    const finalHeight = Math.floor(img.height * 2.0); // Total height - increased for better proportion
    const imageAreaHeight = Math.floor(finalHeight * 0.65);
    const textAreaHeight = Math.floor(finalHeight * 0.35);
    
    canvas.width = img.width;
    canvas.height = finalHeight;

    // Fill background with white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image (scaled to fit 2/3 area)
    const scale = Math.min(1, imageAreaHeight / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const imageX = (canvas.width - scaledWidth) / 2;
    const imageY = 0;
    ctx.drawImage(img, imageX, imageY, scaledWidth, scaledHeight);

    // Prepare text
    const variantText = variant || "Không có biến thể";
    const text = `${variantText} - SL: ${quantity}`;
    
    // Draw text background (35% bottom area)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, imageAreaHeight, canvas.width, textAreaHeight);

    // Calculate maximum font size to fill both width and height
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let fontSize = 30; // Start with a larger base size
    const maxWidth = canvas.width * 0.9; // 90% of canvas width
    const maxHeight = textAreaHeight * 0.7; // 70% of text area height
    
    // Increase font size until text fills the available space
    ctx.font = `bold ${fontSize}px Arial`;
    while (ctx.measureText(text).width < maxWidth && fontSize < maxHeight && fontSize < 300) {
      fontSize += 3;
      ctx.font = `bold ${fontSize}px Arial`;
    }
    // Step back one size if we went over
    if (ctx.measureText(text).width > maxWidth || fontSize > maxHeight) {
      fontSize -= 3;
      ctx.font = `bold ${fontSize}px Arial`;
    }

    // Draw text in red, bold, large
    ctx.fillStyle = "#ff0000";
    const textY = imageAreaHeight + textAreaHeight / 2;
    ctx.fillText(text, canvas.width / 2, textY);

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
