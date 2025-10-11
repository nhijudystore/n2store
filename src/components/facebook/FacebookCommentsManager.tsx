import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Video, MessageCircle, Heart, RefreshCw, Pause, Play, Search, Loader2, Facebook, Code, ChevronDown, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import type { FacebookVideo, FacebookComment, CommentWithStatus, TPOSOrder } from "@/types/facebook";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FacebookPageManager } from "@/components/facebook/FacebookPageManager";

// Helper: Debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function FacebookCommentsManager() {
  const queryClient = useQueryClient();
  const [pageId, setPageId] = useState("117267091364524");
  const [limit, setLimit] = useState("1");
  const [selectedVideo, setSelectedVideo] = useState<FacebookVideo | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
  const [selectedOrderInfo, setSelectedOrderInfo] = useState<TPOSOrder | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const allCommentIdsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // New optimized states
  const [customerStatusMap, setCustomerStatusMap] = useState<Map<string, any>>(new Map());
  const [isLoadingCustomerStatus, setIsLoadingCustomerStatus] = useState(false);
  const fetchInProgress = useRef(false);
  const customerStatusMapRef = useRef<Map<string, any>>(new Map());

  // New states for debug search
  const [videosDebugSearch, setVideosDebugSearch] = useState("");
  const [commentsDebugSearch, setCommentsDebugSearch] = useState("");
  const [ordersDebugSearch, setOrdersDebugSearch] = useState("");
  const [statusMapDebugSearch, setStatusMapDebugSearch] = useState("");
  const [showOnlyWithOrders, setShowOnlyWithOrders] = useState(false);
  const [hideNames, setHideNames] = useState<string[]>(["Nhi Judy House"]);

  // New state for confirmation dialog
  const [confirmCreateOrderComment, setConfirmCreateOrderComment] = useState<CommentWithStatus | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: "JSON đã được sao chép vào clipboard",
    });
  };

  const createOrderMutation = useMutation({
    mutationFn: async ({ comment, video }: { comment: FacebookComment; video: FacebookVideo }) => {
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
          body: JSON.stringify({ comment, video }),
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
      queryClient.invalidateQueries({ queryKey: ["tpos-orders", selectedVideo?.objectId] });
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
      if (!selectedVideo) return;
      createOrderMutation.mutate({ comment, video: selectedVideo });
    }
  };

  const confirmCreateOrder = () => {
    if (confirmCreateOrderComment && selectedVideo) {
      createOrderMutation.mutate({ comment: confirmCreateOrderComment, video: selectedVideo });
    }
    setConfirmCreateOrderComment(null);
  };

  // Fetch videos
  const { data: videos = [], isLoading: videosLoading, refetch: refetchVideos } = useQuery({
    queryKey: ['facebook-videos', pageId, limit],
    queryFn: async () => {
      if (!pageId) return [];
      
      const url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-livevideo?pageId=${pageId}&limit=${limit}`;
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch videos');
      }

      const result = await response.json();
      return (Array.isArray(result) ? result : result.data || []) as FacebookVideo[];
    },
    enabled: !!pageId,
  });

  // Fetch comments with infinite scroll
  const {
    data: commentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchComments,
    isLoading: commentsLoading,
  } = useInfiniteQuery({
    queryKey: ['facebook-comments', pageId, selectedVideo?.objectId],
    queryFn: async ({ pageParam }) => {
      if (!pageId || !selectedVideo?.objectId) return { data: [], paging: {} };
      
      const order = selectedVideo.statusLive === 1 ? 'reverse_chronological' : 'chronological';
      
      let url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${selectedVideo.objectId}&limit=500&order=${order}`;
      if (pageParam) {
        url += `&after=${pageParam}`;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch comments');
      }

      return await response.json();
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.data || lastPage.data.length === 0) {
        return undefined;
      }

      const nextPageCursor = lastPage.paging?.cursors?.after || (lastPage.paging?.next ? new URL(lastPage.paging.next).searchParams.get('after') : null);

      if (!nextPageCursor) {
        return undefined;
      }

      return nextPageCursor;
    },
    initialPageParam: undefined,
    enabled: !!selectedVideo && !!pageId,
    refetchInterval: isAutoRefresh && isCommentsOpen && selectedVideo?.statusLive === 1 ? 10000 : false,
  });

  const comments = useMemo(() => {
    const allComments = commentsData?.pages.flatMap(page => page.data) || [];
    const uniqueComments = new Map<string, FacebookComment>();
    allComments.forEach(comment => {
      uniqueComments.set(comment.id, comment);
    });
    return Array.from(uniqueComments.values());
  }, [commentsData]);

  // Cache orders data with React Query
  const { data: ordersData = [] } = useQuery({
    queryKey: ["tpos-orders", selectedVideo?.objectId],
    queryFn: async () => {
      if (!selectedVideo?.objectId) return [];

      const { data: { session } } = await supabase.auth.getSession();

      const ordersResponse = await fetch(`https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/fetch-facebook-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId: selectedVideo.objectId, top: 200 }),
      });

      if (!ordersResponse.ok) return [];

      const ordersDataResult = await ordersResponse.json();
      return ordersDataResult.value || [];
    },
    enabled: !!selectedVideo?.objectId,
    staleTime: 5 * 60 * 1000,
  });

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

    if (statusMap[normalizedStatus]) {
      return statusMap[normalizedStatus];
    }

    return 'Bình thường';
  };

  const fetchPartnerStatusBatch = useCallback(async (
    commentsToProcess: FacebookComment[], 
    orders: TPOSOrder[]
  ) => {
    if (fetchInProgress.current) return;
    if (commentsToProcess.length === 0) return;

    fetchInProgress.current = true;
    setIsLoadingCustomerStatus(true);

    try {
      const facebookIds = commentsToProcess.map(c => c.from.id);
      const facebookIdsToFetch = facebookIds.filter(id => !customerStatusMapRef.current.has(id));
      
      if (facebookIdsToFetch.length === 0) return;
      
      const { data: existingCustomers = [] } = await supabase
        .from('customers')
        .select('*')
        .in('facebook_id', facebookIdsToFetch);

      const existingCustomersMap = new Map(existingCustomers.map(c => [c.facebook_id, c]));
      const newStatusMap = new Map(customerStatusMapRef.current);
      
      existingCustomers.forEach(customer => {
        const hasCompleteInfoInDB = !!customer.phone && customer.info_status === 'complete';
        const statusText = hasCompleteInfoInDB
          ? mapStatusText(customer.customer_status)
          : 'Cần thêm TT';
        
        newStatusMap.set(customer.facebook_id, {
          partnerStatus: statusText,
          orderInfo: customer.phone ? { Telephone: customer.phone } as any : undefined,
          isLoadingStatus: false,
        });
      });

      const commentsNeedingProcessing = commentsToProcess.filter(
        c => {
          const existingCustomer = existingCustomersMap.get(c.from.id);
          return !existingCustomer || !existingCustomer.phone || existingCustomer.info_status === 'incomplete';
        }
      );

      if (commentsNeedingProcessing.length === 0) {
        setCustomerStatusMap(newStatusMap);
        return;
      }

      const commentOrderMap = new Map<string, TPOSOrder>();
      const commentPhoneMap = new Map<string, string>();

      for (const comment of commentsNeedingProcessing) {
        const order = orders.find(o => 
          o.Facebook_CommentId === comment.id || 
          (o.Facebook_ASUserId === comment.from.id && o.Facebook_UserName?.toLowerCase() === comment.from.name.toLowerCase())
        );

        if (order) {
          commentOrderMap.set(comment.id, order);
          if (order.Telephone) {
            commentPhoneMap.set(comment.id, order.Telephone);
          }
        }
      }

      const customersToUpsertMap = new Map<string, any>();

      for (const comment of commentsNeedingProcessing) {
        const order = commentOrderMap.get(comment.id);
        const phone = commentPhoneMap.get(comment.id);
        const existingCustomer = existingCustomersMap.get(comment.from.id);
        const currentStatus = existingCustomer?.customer_status || 'Bình thường';
        
        const customerData = order && phone ? {
          customer_name: order.Name,
          phone: phone,
          facebook_id: comment.from.id,
          customer_status: currentStatus,
          info_status: 'complete',
        } : {
          customer_name: comment.from.name,
          phone: null,
          facebook_id: comment.from.id,
          customer_status: currentStatus,
          info_status: 'incomplete',
        };

        if (customerData.facebook_id && typeof customerData.facebook_id === 'string' && customerData.facebook_id.trim() !== '') {
          customersToUpsertMap.set(customerData.facebook_id, customerData);
        }

        newStatusMap.set(comment.from.id, {
          partnerStatus: customerData.phone ? customerData.customer_status : 'Cần thêm TT',
          orderInfo: order,
          isLoadingStatus: false,
        });
      }

      const customersToUpsert = Array.from(customersToUpsertMap.values());

      if (customersToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from("customers")
          .upsert(customersToUpsert, { 
            onConflict: "facebook_id",
            ignoreDuplicates: false 
          });

        if (upsertError) {
          toast({
            title: "Lỗi khi lưu khách hàng",
            description: upsertError.message,
            variant: "destructive",
          });
        }
      }

      customerStatusMapRef.current = newStatusMap;
      setCustomerStatusMap(newStatusMap);

    } catch (error) {
      toast({
        title: "Lỗi khi tải thông tin khách hàng",
        variant: "destructive",
      });
    } finally {
      fetchInProgress.current = false;
      setIsLoadingCustomerStatus(false);
    }
  }, [toast, mapStatusText]);

  const debouncedFetchStatus = useMemo(
    () => debounce(fetchPartnerStatusBatch, 100),
    [fetchPartnerStatusBatch]
  );

  useEffect(() => {
    if (!comments.length || !ordersData.length) return;

    const commentsNeedingStatus = comments.filter(
      c => !customerStatusMapRef.current.has(c.from.id)
    );

    if (commentsNeedingStatus.length > 0) {
      debouncedFetchStatus(commentsNeedingStatus, ordersData);
    }
  }, [comments, ordersData, debouncedFetchStatus]);

  const commentsWithStatus = useMemo((): CommentWithStatus[] => {
    return comments.map((comment) => {
      const status = customerStatusMap.get(comment.from.id);
      
      return {
        ...comment,
        partnerStatus: status?.partnerStatus || "Khách lạ",
        orderInfo: status?.orderInfo,
        isLoadingStatus: status?.isLoadingStatus ?? false,
      };
    });
  }, [comments, customerStatusMap]);

  useEffect(() => {
    if (comments.length === 0) {
      allCommentIdsRef.current = new Set();
      return;
    }
    
    const currentIds = new Set(comments.map(c => c.id));
    const previousIds = allCommentIdsRef.current;
    
    const newIds = new Set<string>();
    currentIds.forEach(id => {
      if (!previousIds.has(id)) {
        newIds.add(id);
      }
    });
    
    if (newIds.size > 0 && previousIds.size > 0) {
      setNewCommentIds(newIds);
      toast({
        title: `🔔 ${newIds.size} comment mới!`,
      });
      
      if (newIds.size < 20 && scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
      
      setTimeout(() => {
        setNewCommentIds(new Set());
      }, 3000);
    }
    
    allCommentIdsRef.current = currentIds;
  }, [comments, toast]);

  const handleLoadVideos = async () => {
    if (!pageId) {
      toast({
        title: "Vui lòng nhập Page ID",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await refetchVideos();
      toast({
        title: "Đã tải videos thành công!",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi khi tải videos: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleVideoClick = (video: FacebookVideo) => {
    setSelectedVideo(video);
    setIsCommentsOpen(true);
    allCommentIdsRef.current = new Set();
    setNewCommentIds(new Set());
    setSearchQuery("");
  };

  const handleShowInfo = (orderInfo: TPOSOrder | undefined) => {
    if (orderInfo) {
      setSelectedOrderInfo(orderInfo);
      setIsInfoDialogOpen(true);
    } else {
      toast({
        title: "Chưa có thông tin đơn hàng",
        variant: "destructive",
      });
    }
  };

  const filteredComments = useMemo(() => {
    return commentsWithStatus.filter(comment => {
      const matchesSearch = !searchQuery ||
        comment.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.from?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesOrderFilter = !showOnlyWithOrders || (comment.orderInfo && comment.orderInfo.Code);
      const notHidden = !hideNames.includes(comment.from?.name || '');

      return matchesSearch && matchesOrderFilter && notHidden;
    });
  }, [commentsWithStatus, searchQuery, showOnlyWithOrders, hideNames]);

  const stats = {
    totalVideos: videos.length,
    liveVideos: videos.filter(v => v.statusLive === 1).length,
    totalComments: videos.reduce((sum, v) => sum + (v.countComment || 0), 0),
    totalReactions: videos.reduce((sum, v) => sum + (v.countReaction || 0), 0),
  };

  const filteredVideosForDebug = useMemo(() => {
    if (!videosDebugSearch) return videos;
    const searchTerm = videosDebugSearch.toLowerCase();
    return videos.filter(video =>
      JSON.stringify(video).toLowerCase().includes(searchTerm)
    );
  }, [videos, videosDebugSearch]);

  const filteredCommentsForDebug = useMemo(() => {
    if (!commentsDebugSearch) return comments;
    const searchTerm = commentsDebugSearch.toLowerCase();
    return comments.filter(comment =>
      JSON.stringify(comment).toLowerCase().includes(searchTerm)
    );
  }, [comments, commentsDebugSearch]);

  const filteredOrdersForDebug = useMemo(() => {
    if (!ordersDebugSearch) return ordersData;
    const searchTerm = ordersDebugSearch.toLowerCase();
    return ordersData.filter(order =>
      JSON.stringify(order).toLowerCase().includes(searchTerm)
    );
  }, [ordersData, ordersDebugSearch]);

  const filteredStatusMapForDebug = useMemo(() => {
    if (!statusMapDebugSearch) return Object.fromEntries(customerStatusMap);
    const searchTerm = statusMapDebugSearch.toLowerCase();
    const filteredEntries = Array.from(customerStatusMap.entries()).filter(
      ([key, value]) =>
        key.toLowerCase().includes(searchTerm) ||
        JSON.stringify(value).toLowerCase().includes(searchTerm)
    );
    return Object.fromEntries(filteredEntries);
  }, [customerStatusMap, statusMapDebugSearch]);

  const allCommentsLoaded = useMemo(() => {
    if (!selectedVideo || selectedVideo.statusLive === 1) return false;
    return commentsWithStatus.length >= selectedVideo.countComment;
  }, [commentsWithStatus, selectedVideo]);

  return (
    <div className="space-y-6">
      <Card>
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center justify-between p-4 data-[state=open]:border-b">
              <div>
                <CardTitle>Quản lý Facebook Pages</CardTitle>
                <CardDescription>
                  Thêm và cấu hình CRM Team ID cho các Facebook pages
                </CardDescription>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4">
              <FacebookPageManager />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình và Videos</CardTitle>
          <CardDescription>
            Nhập Facebook Page ID để tải danh sách các video live
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={pageId} onValueChange={setPageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn fanpage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="117267091364524">
                    Fanpage NhiJudyHouse
                  </SelectItem>
                  <SelectItem value="193642490509664">
                    Fanpage NhiJudy Nè
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Input
                type="number"
                placeholder="Limit"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                min="1"
                max="50"
              />
            </div>
            <Button onClick={handleLoadVideos} disabled={videosLoading}>
              {videosLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tải Videos
                </>
              )}
            </Button>
          </div>

          {videos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Video className="mx-auto h-8 w-8 mb-2 text-primary" />
                    <div className="text-2xl font-bold">{stats.totalVideos}</div>
                    <div className="text-sm text-muted-foreground">Videos</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Badge variant="destructive" className="mb-2">LIVE</Badge>
                    <div className="text-2xl font-bold">{stats.liveVideos}</div>
                    <div className="text-sm text-muted-foreground">Đang Live</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <MessageCircle className="mx-auto h-8 w-8 mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{(stats.totalComments || 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Comments</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Heart className="mx-auto h-8 w-8 mb-2 text-red-500" />
                    <div className="text-2xl font-bold">{(stats.totalReactions || 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Reactions</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {videos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <Card
                  key={video.objectId}
                  className="cursor-pointer hover:shadow-lg transition-all overflow-hidden"
                  onClick={() => handleVideoClick(video)}
                >
                  <div className="relative aspect-video bg-muted">
                    {video.thumbnail?.url ? (
                      <img
                        src={video.thumbnail.url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-12 w-12 text-muted-foreground opacity-30" />
                      </div>
                    )}
                    {video.statusLive === 1 && (
                      <Badge variant="destructive" className="absolute top-2 right-2">
                        🔴 LIVE
                      </Badge>
                    )}
                  </div>
                  
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base line-clamp-2">
                      {video.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {format(new Date(video.channelCreatedTime), 'dd/MM/yyyy HH:mm')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        <span>{(video.countComment || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        <span>{(video.countReaction || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments Dialog */}
      <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="line-clamp-1">{selectedVideo?.title}</span>
              {selectedVideo?.statusLive === 1 && (
                <Badge variant="destructive">LIVE</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Xem và theo dõi comments từ video live
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              >
                {isAutoRefresh ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchComments()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              {newCommentIds.size > 0 && (
                <Badge variant="default" className="ml-auto">
                  {newCommentIds.size} mới
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="show-only-with-orders" checked={showOnlyWithOrders} onCheckedChange={(checked) => setShowOnlyWithOrders(checked as boolean)} />
                <Label htmlFor="show-only-with-orders" className="text-sm font-medium whitespace-nowrap">
                  Chỉ hiển thị comment có đơn
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="hide-page-comments" 
                  checked={hideNames.includes("Nhi Judy House")} 
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setHideNames(["Nhi Judy House"]);
                    } else {
                      setHideNames([]);
                    }
                  }} 
                />
                <Label htmlFor="hide-page-comments" className="text-sm font-medium whitespace-nowrap">
                  Ẩn "Nhi Judy House"
                </Label>
              </div>
              <div className="text-sm text-muted-foreground">
                Hiển thị {filteredComments.length} / {commentsWithStatus.length} comments
              </div>
            </div>

            <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
              <div className="space-y-4">
                {commentsLoading && comments.length === 0 ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  </div>
                ) : filteredComments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {searchQuery ? "Không tìm thấy comment nào" : "Chưa có comment"}
                  </div>
                ) : (
                  filteredComments.map((comment) => {
                    const isNew = newCommentIds.has(comment.id);
                    const status = comment.partnerStatus || 'Khách lạ';
                    const isWarning = status.toLowerCase().includes('cảnh báo') || status.toLowerCase().includes('warning');
                    
                    return (
                      <Card
                        key={comment.id}
                        className={isNew ? "border-primary bg-primary/5 animate-in fade-in slide-in-from-bottom-2" : ""}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">
                                {comment.from?.name?.charAt(0) || '?'}
                              </div>
                              {comment.orderInfo?.SessionIndex && (
                                <Badge 
                                  variant="destructive" 
                                  className="absolute -bottom-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-semibold"
                                >
                                  {comment.orderInfo.SessionIndex}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{comment.from?.name}</span>
                                {comment.orderInfo?.Code && (
                                  <Badge variant="secondary" className="text-xs font-mono bg-gray-600 text-white">
                                    #{comment.orderInfo.SessionIndex}. {comment.orderInfo.Code}
                                  </Badge>
                                )}
                                {comment.partnerStatus && comment.partnerStatus !== 'Khách lạ' && comment.partnerStatus !== 'Cần thêm TT' && (
                                  <Badge 
                                    variant={
                                      comment.partnerStatus === 'Bình thường' || comment.partnerStatus === 'Thân thiết' || comment.partnerStatus === 'Vip' || comment.partnerStatus === 'VIP' ? 'default' :
                                      comment.partnerStatus === 'Cảnh báo' ? 'secondary' :
                                      'destructive'
                                    }
                                    className="text-xs"
                                  >
                                    {comment.partnerStatus}
                                  </Badge>
                                )}
                                {comment.orderInfo?.Telephone ? (
                                  <Badge variant="outline" className="text-xs">
                                    {comment.orderInfo.Telephone}
                                  </Badge>
                                ) : comment.partnerStatus === 'Cần thêm TT' ? (
                                  <Badge variant="secondary" className="text-xs bg-red-500/20 text-red-700">
                                    Cần thêm TT
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-700">
                                    Chưa có TT
                                  </Badge>
                                )}
                                {isNew && (
                                  <Badge variant="default" className="text-xs">✨ MỚI</Badge>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {format(new Date(comment.created_time), 'dd/MM/yyyy HH:mm')}
                                </span>
                              </div>
                              
                              <p className="text-sm mt-1.5 break-words">{comment.message}</p>
                              
                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <Button 
                                  size="sm" 
                                  className="h-7 text-xs"
                                  onClick={() => handleCreateOrderClick(comment)}
                                  disabled={(createOrderMutation.isPending && createOrderMutation.variables?.comment.id === comment.id)}
                                >
                                  {createOrderMutation.isPending && createOrderMutation.variables?.comment.id === comment.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Tạo đơn hàng
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-xs"
                                  onClick={() => handleShowInfo(comment.orderInfo)}
                                >
                                  Thông tin
                                </Button>
                                <Badge 
                                  variant="secondary"
                                  className={isWarning
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                                  }
                                >
                                  {comment.isLoadingStatus ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      Đang tải...
                                    </>
                                  ) : status}
                                </Badge>
                                {comment.like_count > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                                    <Heart className="h-3 w-3" />
                                    {comment.like_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
                {allCommentsLoaded ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Đã tải tất cả bình luận.
                  </div>
                ) : hasNextPage && (
                  <div className="text-center py-4">
                    <Button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      variant="outline"
                    >
                      {isFetchingNextPage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Tải thêm bình luận
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="text-sm text-muted-foreground text-center">
              {selectedVideo && selectedVideo.statusLive !== 1
                ? `Hiển thị ${filteredComments.length} / ${commentsWithStatus.length} comments (Tổng: ${selectedVideo.countComment})`
                : `Hiển thị ${filteredComments.length} / ${commentsWithStatus.length} comments`
              }
              {isAutoRefresh && " • Auto-refresh mỗi 10s"}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Info Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thông tin đơn hàng</DialogTitle>
            <DialogDescription>
              Chi tiết đơn hàng từ TPOS
            </DialogDescription>
          </DialogHeader>

          {selectedOrderInfo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Mã đơn</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.Code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Trạng thái</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.StatusText}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Khách hàng</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.Name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Số điện thoại</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.Telephone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Partner</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.PartnerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Partner Status</label>
                  <Badge variant={selectedOrderInfo.PartnerStatus === 'Normal' ? 'default' : 'destructive'}>
                    {selectedOrderInfo.PartnerStatusText || selectedOrderInfo.PartnerStatus}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium">Tổng tiền</label>
                  <p className="text-sm text-muted-foreground">
                    {(selectedOrderInfo.TotalAmount || 0).toLocaleString('vi-VN')} đ
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Số lượng</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.TotalQuantity}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Ghi chú</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.Note || 'Không có'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Ngày tạo</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedOrderInfo.DateCreated), 'dd/MM/yyyy HH:mm:ss')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmCreateOrderComment} onOpenChange={() => setConfirmCreateOrderComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận tạo đơn hàng mới</AlertDialogTitle>
            <AlertDialogDescription>
              Bình luận này đã có đơn hàng. Bạn có chắc chắn muốn tạo thêm một đơn hàng mới không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCreateOrder}>Tạo đơn mới</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mt-6">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center justify-between p-4 data-[state=open]:border-b">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                <CardTitle className="text-base">Xem Dữ Liệu API (Debug)</CardTitle>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <h3 className="font-semibold mb-2">1. Videos Response</h3>
                <Input
                  placeholder="Tìm kiếm trong videos response..."
                  value={videosDebugSearch}
                  onChange={(e) => setVideosDebugSearch(e.target.value)}
                  className="mb-2"
                />
                <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted/50">
                  <pre className="text-xs">{JSON.stringify(filteredVideosForDebug, null, 2)}</pre>
                </ScrollArea>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold mb-2">2. Comments Response</h3>
                <Input
                  placeholder="Tìm kiếm trong comments response..."
                  value={commentsDebugSearch}
                  onChange={(e) => setCommentsDebugSearch(e.target.value)}
                  className="mb-2"
                />
                <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted/50">
                  <pre className="text-xs">{JSON.stringify(filteredCommentsForDebug, null, 2)}</pre>
                </ScrollArea>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold mb-2">3. TPOS Orders Response</h3>
                <Input
                  placeholder="Tìm kiếm trong orders response..."
                  value={ordersDebugSearch}
                  onChange={(e) => setOrdersDebugSearch(e.target.value)}
                  className="mb-2"
                />
                <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted/50">
                  <pre className="text-xs">{JSON.stringify(filteredOrdersForDebug, null, 2)}</pre>
                </ScrollArea>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold mb-2">4. Processed Customer Status Map</h3>
                <Input
                  placeholder="Tìm kiếm trong status map..."
                  value={statusMapDebugSearch}
                  onChange={(e) => setStatusMapDebugSearch(e.target.value)}
                  className="mb-2"
                />
                <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted/50">
                  <pre className="text-xs">{JSON.stringify(filteredStatusMapForDebug, null, 2)}</pre>
                </ScrollArea>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
