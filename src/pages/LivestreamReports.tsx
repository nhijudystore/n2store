import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, BarChart3 } from "lucide-react";
import { CreateLivestreamReportDialog } from "@/components/livestream-reports/CreateLivestreamReportDialog";
import { EditLivestreamReportDialog } from "@/components/livestream-reports/EditLivestreamReportDialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { parseTimeRangeForDisplay } from "@/lib/time-utils";

interface LivestreamReport {
  id: string;
  report_date: string;
  morning_ad_cost: number;
  evening_ad_cost: number;
  morning_duration: string;
  evening_duration: string;
  morning_live_orders: number;
  evening_live_orders: number;
  total_inbox_orders: number;
}

const LivestreamReports = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [editingReport, setEditingReport] = React.useState<LivestreamReport | null>(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["livestream-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestream_reports")
        .select("*")
        .order("report_date", { ascending: false });
      
      if (error) throw error;
      return data as LivestreamReport[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("livestream_reports")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["livestream-reports"] });
      toast({
        title: "Thành công",
        description: "Đã xóa báo cáo thành công",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi xóa báo cáo",
        variant: "destructive",
      });
    },
  });

  const filteredReports = reports.filter((report) =>
    format(new Date(report.report_date), "dd/MM/yyyy").includes(searchTerm) ||
    report.report_date.includes(searchTerm)
  );

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa báo cáo này?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Báo Cáo Livestream</h1>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Thêm báo cáo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách báo cáo</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Tìm kiếm theo ngày..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Ngày</TableHead>
                  <TableHead className="text-center">Tiền QC</TableHead>
                  <TableHead className="text-center">Thời Gian</TableHead>
                  <TableHead className="text-center">Số món Live</TableHead>
                  <TableHead className="text-center">Số món Inbox</TableHead>
                  <TableHead className="text-center">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Không có báo cáo nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map((report) => (
                    <React.Fragment key={report.id}>
                      {/* Morning row */}
                      <TableRow className="bg-muted/20">
                        <TableCell rowSpan={2} className="text-center font-medium border-r">
                          {format(new Date(report.report_date), "dd/MM/yyyy", { locale: vi })}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="outline" className="text-xs">Sáng</Badge>
                            <span className="text-sm font-medium">
                              {formatCurrency(report.morning_ad_cost)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="outline" className="text-xs">Sáng</Badge>
                            <div className="text-sm whitespace-pre-line leading-tight">
                              {(() => {
                                const timeData = parseTimeRangeForDisplay(report.morning_duration || "");
                                return timeData.timeRange !== "-" 
                                  ? `${timeData.timeRange}\n${timeData.duration}`
                                  : "-";
                              })()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="outline" className="text-xs">Sáng</Badge>
                            <span className="text-sm font-medium">
                              {report.morning_live_orders}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell rowSpan={2} className="text-center font-medium border-l">
                          <span className="text-lg font-bold text-primary">
                            {report.total_inbox_orders}
                          </span>
                        </TableCell>
                        <TableCell rowSpan={2} className="text-center border-l">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingReport(report)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(report.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Evening row */}
                      <TableRow className="bg-muted/10">
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="secondary" className="text-xs">Chiều</Badge>
                            <span className="text-sm font-medium">
                              {formatCurrency(report.evening_ad_cost)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="secondary" className="text-xs">Chiều</Badge>
                            <div className="text-sm whitespace-pre-line leading-tight">
                              {(() => {
                                const timeData = parseTimeRangeForDisplay(report.evening_duration || "");
                                return timeData.timeRange !== "-" 
                                  ? `${timeData.timeRange}\n${timeData.duration}`
                                  : "-";
                              })()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="secondary" className="text-xs">Chiều</Badge>
                            <span className="text-sm font-medium">
                              {report.evening_live_orders}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateLivestreamReportDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {editingReport && (
        <EditLivestreamReportDialog
          report={editingReport}
          open={!!editingReport}
          onOpenChange={(open) => !open && setEditingReport(null)}
        />
      )}
    </div>
  );
};

export default LivestreamReports;