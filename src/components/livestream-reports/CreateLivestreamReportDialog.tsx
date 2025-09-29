import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  report_date: z.date({
    required_error: "Vui lòng chọn ngày báo cáo",
  }),
  morning_ad_cost: z.number().min(0, "Giá trị phải lớn hơn hoặc bằng 0"),
  evening_ad_cost: z.number().min(0, "Giá trị phải lớn hơn hoặc bằng 0"),
  morning_duration: z.string().optional(),
  evening_duration: z.string().optional(),
  morning_live_orders: z.number().min(0, "Giá trị phải lớn hơn hoặc bằng 0"),
  evening_live_orders: z.number().min(0, "Giá trị phải lớn hơn hoặc bằng 0"),
  total_inbox_orders: z.number().min(0, "Giá trị phải lớn hơn hoặc bằng 0"),
});

type FormData = z.infer<typeof formSchema>;

interface CreateLivestreamReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateLivestreamReportDialog: React.FC<CreateLivestreamReportDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      morning_ad_cost: 0,
      evening_ad_cost: 0,
      morning_duration: "",
      evening_duration: "",
      morning_live_orders: 0,
      evening_live_orders: 0,
      total_inbox_orders: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from("livestream_reports")
        .insert([{
          report_date: format(data.report_date, "yyyy-MM-dd"),
          morning_ad_cost: data.morning_ad_cost,
          evening_ad_cost: data.evening_ad_cost,
          morning_duration: data.morning_duration || null,
          evening_duration: data.evening_duration || null,
          morning_live_orders: data.morning_live_orders,
          evening_live_orders: data.evening_live_orders,
          total_inbox_orders: data.total_inbox_orders,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["livestream-reports"] });
      toast({
        title: "Thành công",
        description: "Đã tạo báo cáo mới thành công",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message.includes("duplicate") 
          ? "Báo cáo cho ngày này đã tồn tại"
          : "Có lỗi xảy ra khi tạo báo cáo",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo báo cáo livestream mới</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="report_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Ngày báo cáo</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy", { locale: vi })
                          ) : (
                            <span>Chọn ngày</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-center">Phiên Sáng</h3>
                
                <FormField
                  control={form.control}
                  name="morning_ad_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiền quảng cáo (VNĐ)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="morning_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian live</FormLabel>
                      <FormControl>
                        <Input placeholder="VD: 2h30p" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="morning_live_orders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số món trên live</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-center">Phiên Chiều</h3>
                
                <FormField
                  control={form.control}
                  name="evening_ad_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiền quảng cáo (VNĐ)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="evening_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thời gian live</FormLabel>
                      <FormControl>
                        <Input placeholder="VD: 3h15p" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="evening_live_orders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số món trên live</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="total_inbox_orders"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tổng số món inbox</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Đang tạo..." : "Tạo báo cáo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};