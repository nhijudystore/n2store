import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AddProductToLiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
  sessionId: string;
}

interface FormData {
  product_code: string;
  product_name: string;
  prepared_quantity: number;
}

export function AddProductToLiveDialog({ open, onOpenChange, phaseId, sessionId }: AddProductToLiveDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      product_code: "",
      product_name: "",
      prepared_quantity: 0,
    },
  });

  const addProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from("live_products")
        .insert([{
          live_session_id: sessionId,
          live_phase_id: phaseId,
          product_code: data.product_code.trim(),
          product_name: data.product_name.trim(),
          prepared_quantity: data.prepared_quantity,
          sold_quantity: 0,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      toast.success("Đã thêm sản phẩm vào phiên live thành công");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error adding product to live:", error);
      toast.error("Có lỗi xảy ra khi thêm sản phẩm");
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!phaseId) {
      toast.error("Vui lòng chọn một phiên live");
      return;
    }

    if (!data.product_code.trim() || !data.product_name.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin sản phẩm");
      return;
    }

    if (data.prepared_quantity < 0) {
      toast.error("Số lượng chuẩn bị phải lớn hơn hoặc bằng 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await addProductMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm Sản Phẩm Vào Live</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã sản phẩm *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập mã sản phẩm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên sản phẩm *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập tên sản phẩm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prepared_quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số lượng chuẩn bị</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      min="0"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !phaseId}
                className="flex-1"
              >
                {isSubmitting ? "Đang thêm..." : "Thêm sản phẩm"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}