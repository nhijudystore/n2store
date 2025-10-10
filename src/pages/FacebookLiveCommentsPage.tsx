import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Video, MessageCircle, Heart, RefreshCw, Pause, Play, Search, Loader2, Facebook } from "lucide-react";
import { format } from "date-fns";
import type { FacebookVideo, FacebookComment, CommentWithStatus, TPOSOrder } from "@/types/facebook";

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

export default function FacebookLiveCommentsPage() {
  const queryClient = useQueryClient();
  const [pageId, setPageId] = useState("117267091364524");
  const [limit, setLimit] = useState("10");
  const [selectedVideo, setSelectedVideo] = useState<FacebookVideo | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [previousCommentIds, setPreviousCommentIds] = useState<Set<string>>(new Set());
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
  const [selectedOrderInfo, setSelectedOrderInfo] = useState<TPOSOrder | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // New optimized states
  const [customerStatusMap, setCustomerStatusMap] = useState<Map<string, any>>(new Map());
  const [isLoadingCustomerStatus, setIsLoadingCustomerStatus] = useState(false);
  const fetchInProgress = useRef(false);

  // Fetch videos (giữ nguyên code cũ - đang hoạt động)
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
    enabled: false,
  });

  // Fetch comments (giữ nguyên code cũ)
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['facebook-comments', pageId, selectedVideo?.objectId],
    queryFn: async () => {
      if (!pageId || !selectedVideo?.objectId) return [];
      
      const url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${selectedVideo.objectId}&limit=500`;
      
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

      const result = await response.json();
      return (Array.isArray(result) ? result : result.data || []) as FacebookComment[];
    },
    enabled: !!selectedVideo && !!pageId,
    refetchInterval: isAutoRefresh && isCommentsOpen ? 10000 : false,
  });

  // Cache orders data với React Query
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
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });

  // Cải thiện hàm mapStatusText để xử lý cả tiếng Anh và tiếng Việt
  const mapStatusText = (statusText: string | null | undefined): string => {
    if (!statusText) return 'Bình thường'; // Default if input is null/undefined/empty

    const normalizedStatus = statusText.trim().toLowerCase();

    const statusMap: Record<string, string> = {
      // English to Vietnamese mappings
      'normal': 'Bình thường',
      'bomb': 'Bom hàng',
      'warning': 'Cảnh báo',
      'wholesale': 'Khách sỉ',
      'danger': 'Nguy hiểm',
      'close': 'Thân thiết',
      'vip': 'VIP',
      'thieu thong tin': 'Thiếu thông tin', // Custom status for incomplete info
      'incomplete': 'Cần thêm TT', // Custom status for incomplete info

      // Vietnamese to Vietnamese (for consistency, if input is already Vietnamese)
      'bình thường': 'Bình thường',
      'bom hàng': 'Bom hàng',
      'cảnh báo': 'Cảnh báo',
      'khách sỉ': 'Khách sỉ',
      'nguy hiểm': 'Nguy hiểm',
      'thân thiết': 'Thân thiết',
      'thiếu thông tin': 'Thiếu thông tin',
      'cần thêm tt': 'Cần thêm TT',
    };

    // Check for direct match in the map
    if (statusMap[normalizedStatus]) {
      return statusMap[normalizedStatus];
    }

    // If no specific mapping, return "Bình thường" as a fallback, and log a warning.
    console.warn(`[mapStatusText] Unknown status received: "${statusText}". Defaulting to "Bình thường".`);
    return 'Bình thường';
  };

  // Optimized fetchPartnerStatusBatch
  const fetchPartnerStatusBatch = useCallback(async (
    commentsToProcess: FacebookComment[], 
    orders: TPOSOrder[]
  ) => {
    if (fetchInProgress.current) {
      console.log('[Fetch] Already in progress, skipping...');
      return;
    }

    if (commentsToProcess.length === 0) return;

    fetchInProgress.current = true;
    setIsLoadingCustomerStatus(true);

    try {
      console.log('[Fetch] Processing', commentsToProcess.length, 'comments');

      // Step 1: Check existing customers from Supabase
      const facebookIds = commentsToProcess.map(c => c.from.id);
      const { data: existingCustomers = [] } = await supabase
        .from('customers')
        .select('*')
        .in('facebook_id', facebookIds);
      
      console.log('[Fetch] Found', existingCustomers.length, 'existing customers in Supabase');

      const existingCustomersMap = new Map(existingCustomers.map(c => [c.facebook_id, c]));

      // Initialize newStatusMap with existing Supabase data
      const newStatusMap = new Map(customerStatusMap);
      existingCustomers.forEach(customer => {
        const hasCompleteInfoInDB = !!customer.phone && customer.info_status === 'complete';
        const statusText = hasCompleteInfoInDB
          ? mapStatusText(customer.customer_status)
          : 'Cần thêm TT'; // If info is incomplete in DB, mark as such
        
        newStatusMap.set(customer.facebook_id, {
          partnerStatus: statusText,
          orderInfo: customer.phone ? { Telephone: customer.phone } as any : undefined,
          isLoadingStatus: false, // Already loaded from DB
        });
      });

      // Identify comments that still need TPOS fetch
      const commentsNeedingTPOSFetch = commentsToProcess.filter(
        c => {
          const existingCustomer = existingCustomersMap.get(c.from.id);
          // If customer doesn't exist in Supabase, or exists but has incomplete info, fetch from TPOS
          return !existingCustomer || !existingCustomer.phone || existingCustomer.info_status === 'incomplete';
        }
      );

      console.log('[Fetch] Found', commentsNeedingTPOSFetch.length, 'comments needing TPOS fetch');

      if (commentsNeedingTPOSFetch.length === 0) {
        setCustomerStatusMap(newStatusMap); // No TPOS fetch needed, update map with only DB data
        return;
      }

      // Step 2: Map comments to orders (only for commentsNeedingTPOSFetch)
      const commentOrderMap = new Map<string, TPOSOrder>();
      const phoneNumbers: string[] = [];
      const commentPhoneMap = new Map<string, string>();

      for (const comment of commentsNeedingTPOSFetch) { // Use commentsNeedingTPOSFetch here
        const order = orders.find(o => 
          o.Facebook_CommentId === comment.id || 
          o.Facebook_UserName?.toLowerCase() === comment.from.name.toLowerCase()
        );

        if (order) {
          commentOrderMap.set(comment.id, order);
          if (order.Telephone) {
            commentPhoneMap.set(comment.id, order.Telephone);
            if (!phoneNumbers.includes(order.Telephone)) {
              phoneNumbers.push(order.Telephone);
            }
          }
        }
      }

      console.log('[Fetch] Matched', commentOrderMap.size, 'orders from TPOS for comments needing fetch');
      console.log('[Fetch] Unique phones for TPOS fetch:', phoneNumbers.length);

      // Step 3: Batch fetch partner status from TPOS
      const partnerStatusMap = new Map<string, string>();
      const { data: { session } } = await supabase.auth.getSession();
      
      for (let i = 0; i < phoneNumbers.length; i += 10) {
        const batch = phoneNumbers.slice(i, i + 10);
        
        console.log(`[Fetch] Calling fetch-partner-status with batch:`, batch);
        const partnerResponse = await fetch(`https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/fetch-partner-status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phones: batch }),
        });

        if (partnerResponse.ok) {
          const partnerData = await partnerResponse.json();
          const partners = partnerData.value || [];
          console.log(`[Fetch] Received ${partners.length} partners for batch:`, partners);

          for (const comment of commentsNeedingTPOSFetch) { // Use commentsNeedingTPOSFetch here
            const order = commentOrderMap.get(comment.id);
            const phone = commentPhoneMap.get(comment.id);
            
            if (phone && order) {
              // IMPORTANT: TPOS API might return multiple partners for a phone.
              // We need to find the one that matches the order's name.
              const matchingPartner = partners.find(
                (p: any) => p.Name === order.Name && p.Phone === phone
              );
              
              if (matchingPartner?.StatusText) {
                partnerStatusMap.set(comment.id, matchingPartner.StatusText);
                console.log(`[Fetch] Matched partner status for comment ${comment.id}: ${matchingPartner.StatusText}`);
              } else {
                console.log(`[Fetch] No matching partner status found for comment ${comment.id} (phone: ${phone}, order name: ${order.Name})`);
              }
            }
          }
        } else {
          const errorText = await partnerResponse.text();
          console.error(`[Fetch] Error fetching partner status for batch ${batch.join(',')}: ${partnerResponse.status} - ${errorText}`);
        }
      }

      console.log('[Fetch] Partner status map size:', partnerStatusMap.size);

      // Step 4: Batch upsert to customers table
      const customersToUpsertMap = new Map<string, any>(); // Map to deduplicate by facebook_id

      for (const comment of commentsNeedingTPOSFetch) { // Use commentsNeedingTPOSFetch here
        const order = commentOrderMap.get(comment.id);
        const partnerStatus = partnerStatusMap.get(comment.id);
        const phone = commentPhoneMap.get(comment.id);
        
        const customerData = order && phone ? {
          customer_name: order.Name,
          phone: phone,
          facebook_id: comment.from.id,
          customer_status: mapStatusText(partnerStatus), // Sử dụng mapStatusText
          info_status: partnerStatus ? 'complete' : 'incomplete',
        } : {
          customer_name: comment.from.name,
          phone: null,
          facebook_id: comment.from.id,
          customer_status: 'Bình thường',
          info_status: 'incomplete',
        };

        // Ensure facebook_id is a string and not empty for upsert
        if (customerData.facebook_id && typeof customerData.facebook_id === 'string' && customerData.facebook_id.trim() !== '') {
          // Add to map, this will overwrite if a duplicate facebook_id is encountered, effectively deduplicating
          customersToUpsertMap.set(customerData.facebook_id, customerData);
          console.log(`[Fetch] Preparing to upsert customer ${customerData.customer_name} (FB ID: ${customerData.facebook_id}) with status: ${customerData.customer_status}`);
        } else {
          console.warn(`[Fetch] Skipping upsert for comment from ${comment.from.name} due to invalid facebook_id: "${customerData.facebook_id}"`);
        }

        // Update status map (this should still happen for all comments, even if not upserted)
        newStatusMap.set(comment.from.id, {
          partnerStatus: customerData.phone ? customerData.customer_status : 'Cần thêm TT',
          orderInfo: order && phone ? { Telephone: phone } as any : undefined,
          isLoadingStatus: false,
        });
      }

      const customersToUpsert = Array.from(customersToUpsertMap.values()); // Convert map values to array

      // Batch upsert
      if (customersToUpsert.length > 0) {
        console.log('[Fetch] Upserting', customersToUpsert.length, 'customers');

        const { error: upsertError } = await supabase
          .from("customers")
          .upsert(customersToUpsert, { 
            onConflict: "facebook_id",
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error('[Fetch] Error upserting customers:', upsertError); // Log the full error object
          toast({
            title: "Lỗi khi lưu khách hàng",
            description: upsertError.message,
            variant: "destructive",
          });
        } else {
          console.log('[Fetch] Successfully upserted customers');
        }
      } else {
        console.log('[Fetch] No customers with valid facebook_id to upsert.');
      }

      // Update state
      setCustomerStatusMap(newStatusMap);

    } catch (error) {
      console.error('[Fetch] General error in fetchPartnerStatusBatch:', error); // Catch-all error log
      toast({
        title: "Lỗi khi tải thông tin khách hàng",
        variant: "destructive",
      });
    } finally {
      fetchInProgress.current = false;
      setIsLoadingCustomerStatus(false);
    }
  }, [selectedVideo, customerStatusMap, toast, ordersData]);

  // Debounced version
  const debouncedFetchStatus = useMemo(
    () => debounce(fetchPartnerStatusBatch, 500),
    [fetchPartnerStatusBatch]
  );

  // Process new comments only
  useEffect(() => {
    if (!comments.length || !ordersData.length) return;

    // Filter comments that don't have status yet
    const commentsNeedingStatus = comments.filter(
      c => !customerStatusMap.has(c.from.id)
    );

    if (commentsNeedingStatus.length > 0) {
      console.log('[Effect] Found', commentsNeedingStatus.length, 'comments needing status');
      debouncedFetchStatus(commentsNeedingStatus, ordersData);
    }
  }, [comments, ordersData, customerStatusMap, debouncedFetchStatus]);

  // Merge comments with status
  const commentsWithStatus = useMemo((): CommentWithStatus[] => {
    return comments.map((comment) => {
      const status = customerStatusMap.get(comment.from.id);
      
      return {
        ...comment,
        partnerStatus: status?.partnerStatus || "Khách lạ",
        orderInfo: status?.orderInfo,
        isLoadingStatus: status?.isLoadingStatus ?? true,
      };
    });
  }, [comments, customerStatusMap]);

  // Track new comments
  useEffect(() => {
    if (comments.length === 0) return;
    
    const currentIds = new Set(comments.map(c => c.id));
    const newIds = new Set<string>();
    
    if (previousCommentIds.size > 0) {
      currentIds.forEach(id => {
        if (!previousCommentIds.has(id)) {
          newIds.add(id);
        }
      });
      
      if (newIds.size > 0) {
        setNewCommentIds(newIds);
        toast({
          title: `🔔 ${newIds.size} comment mới!`,
        });
        
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
        
        setTimeout(() => {
          setNewCommentIds(new Set());
        }, 3000);
      }
    }
    
    setPreviousCommentIds(currentIds);
  }, [comments, toast, previousCommentIds]);

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
    setPreviousCommentIds(new Set());
    setNewCommentIds(new Set());
    setSearchQuery("");
    setDisplayLimit(20);
    setCustomerStatusMap(new Map()); // Reset status map
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

  const filteredComments = commentsWithStatus.filter(comment =>
    comment.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.from?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedComments = filteredComments.slice(0, displayLimit);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;
    
    if (scrollPercentage > 0.8 && displayLimit < filteredComments.length) {
      setDisplayLimit(prev => Math.min(prev + 20, filteredComments.length));
    }
  }, [displayLimit, filteredComments.length]);

  const stats = {
    totalVideos: videos.length,
    liveVideos: videos.filter(v => v.statusLive === 1).length,
    totalComments: videos.reduce((sum, v) => sum + (v.countComment || 0), 0),
    totalReactions: videos.reduce((sum, v) => sum + (v.countReaction || 0), 0),
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Facebook className="w-8 h-8" />
            Quản lý Comments Live Facebook
          </h1>
          <p className="text-muted-foreground mt-1">
            Theo dõi và quản lý comments từ các video live Facebook
          </p>
        </div>
      </div>

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
              <Input
                placeholder="Nhập Facebook Page ID"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              />
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

          {/* Stats */}
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
                    <div className="text-2xl font-bold">{stats.totalComments.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Comments</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Heart className="mx-auto h-8 w-8 mb-2 text-red-500" />
                    <div className="text-2xl font-bold">{stats.totalReactions.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Reactions</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Video Grid */}
          {videos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <Card
                  key={video.objectId}
                  className="cursor-pointer hover:shadow-lg transition-all overflow-hidden"
                  onClick={() => handleVideoClick(video)}
                >
                  {/* Thumbnail */}
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
                        <span>{video.countComment.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        <span>{video.countReaction.toLocaleString()}</span>
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
            {/* Controls */}
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

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm comments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Comments List */}
            <ScrollArea className="h-[400px] pr-4" ref={scrollRef} onScrollCapture={handleScroll}>
              <div className="space-y-4">
                {filteredComments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {searchQuery ? "Không tìm thấy comment nào" : "Chưa có comment"}
                  </div>
                ) : (
                  displayedComments.map((comment) => {
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
                            {/* Avatar placeholder with badge */}
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">
                                {comment.from?.name?.charAt(0) || '?'}
                              </div>
                              <Badge 
                                variant="destructive" 
                                className="absolute -bottom-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
                              >
                                {Math.floor(Math.random() * 50) + 20}
                              </Badge>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{comment.from?.name}</span>
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
                                {comment.from?.id && (
                                  <Badge variant="outline" className="text-xs">
                                    #{comment.from.id.slice(-8)}
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
                                <Button size="sm" className="h-7 text-xs">
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
                {displayLimit < filteredComments.length && (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="text-sm text-muted-foreground text-center">
              Hiển thị {displayedComments.length} / {filteredComments.length} comments
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
                    {selectedOrderInfo.TotalAmount.toLocaleString('vi-VN')} đ
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
    </div>
  );
}
