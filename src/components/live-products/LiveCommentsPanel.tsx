import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Heart, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { FacebookComment, CommentWithStatus, TPOSOrder } from "@/types/facebook";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LiveCommentsPanelProps {
  pageId: string;
  videoId: string;
  comments: FacebookComment[];
  ordersData: TPOSOrder[];
  newCommentIds: Set<string>;
  showOnlyWithOrders: boolean;
  hideNames: string[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function LiveCommentsPanel({
  pageId,
  videoId,
  comments,
  ordersData,
  newCommentIds,
  showOnlyWithOrders,
  hideNames,
  isLoading,
  onLoadMore,
  hasMore,
}: LiveCommentsPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [customerStatusMap, setCustomerStatusMap] = useState<Map<string, any>>(new Map());
  const [isLoadingCustomerStatus, setIsLoadingCustomerStatus] = useState(false);
  const fetchInProgress = useRef(false);
  const customerStatusMapRef = useRef<Map<string, any>>(new Map());
  const [confirmCreateOrderComment, setConfirmCreateOrderComment] = useState<CommentWithStatus | null>(null);
  const [selectedOrderInfo, setSelectedOrderInfo] = useState<TPOSOrder | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mapStatusText = (statusText: string | null | undefined): string => {
    if (!statusText) return 'Bình thường';
    const normalizedStatus = statusText.trim().toLowerCase();
    const statusMap: Record<string, string> = {
      'normal': 'Bình thường',
      'bomb': 'Bom hàng',
      'warning': 'Cảnh báo',
      'wholesale': 'Khách sỉ',
      'danger': 'Nguy hiểm',
      'close': 'Thân thiết',
      'vip': 'VIP',
      'thieu thong tin': 'Thiếu thông tin',
      'incomplete': 'Cần thêm TT',
      'bình thường': 'Bình thường',
      'bom hàng': 'Bom hàng',
      'cảnh báo': 'Cảnh báo',
      'khách sỉ': 'Khách sỉ',
      'nguy hiểm': 'Nguy hiểm',
      'thân thiết': 'Thân thiết',
      'thiếu thông tin': 'Thiếu thông tin',
      'cần thêm tt': 'Cần thêm TT',
    };
    return statusMap[normalizedStatus] || 'Bình thường';
  };

  const fetchPartnerStatusBatch = useCallback(async (
    commentsToProcess: FacebookComment[], 
    orders: TPOSOrder[]
  ) => {
    if (fetchInProgress.current || commentsToProcess.length === 0) return;

    fetchInProgress.current = true;
    setIsLoadingCustomerStatus(true);

    try {
      const facebookIdsToFetch = [
        ...new Set(
          commentsToProcess
            .map(c => c.from.id)
            .filter(id => id && !customerStatusMapRef.current.has(id))
        )
      ];
      
      if (facebookIdsToFetch.length === 0) {
        fetchInProgress.current = false;
        setIsLoadingCustomerStatus(false);
        return;
      }
      
      const userOrderMap = new Map<string, TPOSOrder>();
      for (const order of orders) {
        if (order.Facebook_ASUserId && !userOrderMap.has(order.Facebook_ASUserId)) {
          userOrderMap.set(order.Facebook_ASUserId, order);
        }
      }

      const { data: existingCustomers = [] } = await supabase
        .from('customers')
        .select('*')
        .in('facebook_id', facebookIdsToFetch);
      const existingCustomersMap = new Map(existingCustomers.map(c => [c.facebook_id, c]));

      const customersToUpsert: any[] = [];
      const newStatusMap = new Map(customerStatusMapRef.current);

      for (const facebookId of facebookIdsToFetch) {
        const order = userOrderMap.get(facebookId);
        const existingCustomer = existingCustomersMap.get(facebookId);
        const commentAuthorName = commentsToProcess.find(c => c.from.id === facebookId)?.from.name || 'Unknown';

        let partnerStatus: string;
        let customerDataForUpsert: any;

        if (order && order.Telephone) {
          partnerStatus = mapStatusText(existingCustomer?.customer_status || order.PartnerStatusText);
          customerDataForUpsert = {
            facebook_id: facebookId,
            customer_name: order.Name || commentAuthorName,
            phone: order.Telephone,
            customer_status: partnerStatus,
            info_status: 'complete',
          };
        } else if (existingCustomer) {
          partnerStatus = mapStatusText(existingCustomer.customer_status);
          if (!existingCustomer.phone || existingCustomer.info_status === 'incomplete') {
            partnerStatus = 'Cần thêm TT';
          }
        } else {
          partnerStatus = 'Khách lạ';
          customerDataForUpsert = {
            facebook_id: facebookId,
            customer_name: commentAuthorName,
            phone: null,
            customer_status: 'Bình thường',
            info_status: 'incomplete',
          };
        }

        if (customerDataForUpsert) {
          customersToUpsert.push(customerDataForUpsert);
        }

        newStatusMap.set(facebookId, {
          partnerStatus,
          orderInfo: order,
          isLoadingStatus: false,
        });
      }

      if (customersToUpsert.length > 0) {
        await supabase
          .from('customers')
          .upsert(customersToUpsert, {
            onConflict: 'facebook_id',
            ignoreDuplicates: false,
          });
      }

      customerStatusMapRef.current = newStatusMap;
      setCustomerStatusMap(newStatusMap);
    } catch (error) {
      console.error('Error fetching partner status batch:', error);
    } finally {
      fetchInProgress.current = false;
      setIsLoadingCustomerStatus(false);
    }
  }, []);

  useEffect(() => {
    if (comments.length > 0 && ordersData.length >= 0) {
      fetchPartnerStatusBatch(comments, ordersData);
    }
  }, [comments, ordersData, fetchPartnerStatusBatch]);

  const createOrderMutation = useMutation({
    mutationFn: async ({ comment }: { comment: FacebookComment }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      const response = await fetch(
        `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/create-tpos-order-from-comment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            comment, 
            video: { objectId: videoId } 
          }),
        }
      );

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(responseData));
      }

      return responseData;
    },
    onSuccess: (data) => {
      toast({
        title: "Tạo đơn hàng thành công!",
        description: `Đơn hàng ${data.response.Code} đã được tạo.`,
      });
      queryClient.invalidateQueries({ queryKey: ["tpos-orders", videoId] });
    },
    onError: (error: any) => {
      let errorData;
      try {
        errorData = JSON.parse(error.message);
      } catch (e) {
        errorData = { error: error.message };
      }

      toast({
        title: "Lỗi tạo đơn hàng",
        description: errorData.error || "Có lỗi không xác định",
        variant: "destructive",
      });
    },
  });

  const handleCreateOrderClick = (comment: CommentWithStatus) => {
    if (comment.orderInfo) {
      setConfirmCreateOrderComment(comment);
    } else {
      createOrderMutation.mutate({ comment });
    }
  };

  const confirmCreateOrder = () => {
    if (confirmCreateOrderComment) {
      createOrderMutation.mutate({ comment: confirmCreateOrderComment });
    }
    setConfirmCreateOrderComment(null);
  };

  const commentsWithStatus: CommentWithStatus[] = useMemo(() => {
    return comments.map((comment) => {
      const statusInfo = customerStatusMap.get(comment.from.id);
      return {
        ...comment,
        partnerStatus: statusInfo?.partnerStatus || 'Đang tải...',
        orderInfo: statusInfo?.orderInfo,
        isLoadingStatus: statusInfo?.isLoadingStatus ?? true,
      };
    });
  }, [comments, customerStatusMap]);

  const filteredComments = useMemo(() => {
    let filtered = commentsWithStatus;

    if (showOnlyWithOrders) {
      filtered = filtered.filter(comment => comment.orderInfo);
    }

    if (hideNames.length > 0) {
      filtered = filtered.filter(comment => 
        !hideNames.some(name => comment.from.name.toLowerCase().includes(name.toLowerCase()))
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(comment =>
        comment.message?.toLowerCase().includes(query) ||
        comment.from.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [commentsWithStatus, showOnlyWithOrders, hideNames, searchQuery]);

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'Bom hàng': 'bg-red-500',
      'Cảnh báo': 'bg-orange-500',
      'Nguy hiểm': 'bg-red-700',
      'Khách lạ': 'bg-gray-500',
      'Cần thêm TT': 'bg-yellow-500',
      'Bình thường': 'bg-green-500',
      'Khách sỉ': 'bg-blue-500',
      'Thân thiết': 'bg-purple-500',
      'VIP': 'bg-amber-500',
    };
    return statusColors[status] || 'bg-gray-500';
  };

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm comment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Comments List */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="space-y-2 pr-4">
          {isLoading && filteredComments.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Không có comment nào
            </div>
          ) : (
            <>
              {filteredComments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    newCommentIds.has(comment.id) ? 'bg-accent' : 'bg-card'
                  }`}
                >
                  {/* Header: Avatar, Name, Order Code, Status, Phone */}
                  <div className="flex items-start gap-2 mb-2">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-[10px] ${
                        comment.orderInfo?.SessionIndex ? 'bg-red-500' : 'bg-blue-500'
                      }`}>
                        {comment.orderInfo?.SessionIndex 
                          ? comment.orderInfo.SessionIndex
                          : comment.from.name.charAt(0).toUpperCase()
                        }
                      </div>
                    </div>

                    {/* Name, Order Code, Status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="font-semibold text-sm">
                          {comment.from.name}
                        </span>
                        
                        {/* Phone Number Badge */}
                        {comment.orderInfo?.Telephone && (
                          <Badge className="bg-slate-700 text-white text-[10px] px-1.5 py-0 font-semibold">
                            {comment.orderInfo.Telephone}
                          </Badge>
                        )}
                        
                        {/* Status Badge */}
                        <Badge className={`${getStatusColor(comment.partnerStatus)} text-white text-[10px] px-1.5 py-0`}>
                          {comment.partnerStatus}
                        </Badge>
                      </div>

                      {/* Comment Message */}
                      <p className="text-xs text-foreground break-words">
                        {comment.message || "(Không có nội dung)"}
                      </p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 text-xs flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => handleCreateOrderClick(comment)}
                      disabled={createOrderMutation.isPending}
                    >
                      Tạo đơn hàng
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs bg-green-500 hover:bg-green-600 text-white border-green-500"
                      onClick={() => {
                        if (comment.orderInfo) {
                          setSelectedOrderInfo(comment.orderInfo);
                          setIsInfoDialogOpen(true);
                        }
                      }}
                    >
                      Thông tin
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-8 text-xs ${getStatusColor(comment.partnerStatus)} text-white border-0`}
                    >
                      {comment.partnerStatus}
                    </Button>
                  </div>
                </div>
              ))}

              {hasMore && (
                <Button
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={onLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tải thêm"}
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmCreateOrderComment} onOpenChange={(open) => !open && setConfirmCreateOrderComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận tạo đơn hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Comment này đã có đơn hàng trên TPOS. Bạn có chắc muốn tạo đơn mới?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCreateOrder}>Tạo đơn</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Info Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thông tin đơn hàng TPOS</DialogTitle>
            <DialogDescription>Chi tiết đơn hàng từ hệ thống TPOS</DialogDescription>
          </DialogHeader>
          {selectedOrderInfo && (
            <div className="space-y-2 text-sm">
              <div><strong>Mã đơn:</strong> {selectedOrderInfo.Code}</div>
              <div><strong>Tên KH:</strong> {selectedOrderInfo.Name}</div>
              <div><strong>SĐT:</strong> {selectedOrderInfo.Telephone}</div>
              <div><strong>Ghi chú:</strong> {selectedOrderInfo.Note}</div>
              <div><strong>Tổng tiền:</strong> {selectedOrderInfo.TotalAmount?.toLocaleString()} đ</div>
              <div><strong>Số lượng:</strong> {selectedOrderInfo.TotalQuantity}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
