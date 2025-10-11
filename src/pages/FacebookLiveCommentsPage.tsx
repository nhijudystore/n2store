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
import { Video, MessageCircle, Heart, RefreshCw, Pause, Play, Search, Loader2, Facebook, Code, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { format } from "date-fns";
import type { FacebookVideo, FacebookComment, CommentWithStatus, TPOSOrder } from "@/types/facebook";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

  // New states for create order response
  const [createOrderResponse, setCreateOrderResponse] = useState<{ data: any; payload: any } | null>(null);
  const [isCreateOrderResponseOpen, setIsCreateOrderResponseOpen] = useState(false);
  
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
      setCreateOrderResponse({ data: data.response, payload: data.payload });
      setIsCreateOrderResponseOpen(true);
      toast({
        title: "Tạo đơn hàng thành công!",
        description: `Đơn hàng ${data.response.Code} đã được tạo.`,
      });
      // Refetch orders to update the UI
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
      setCreateOrderResponse({ data: { error: errorData.error }, payload: errorData.payload });
      setIsCreateOrderResponseOpen(true);
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
    enabled: false,
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
      
      let url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${selectedVideo.objectId}&limit=100&order=${order}`;
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
      const nextPageCursor = lastPage.paging?.cursors?.after || (lastPage.paging?.next ? new URL(lastPage.paging.next).searchParams.get('after') : null);

      if (!nextPageCursor) {
        return undefined;
      }

      // Check for duplicates to prevent infinite loops
      const lastPageIds = new Set(lastPage.data.map((c: FacebookComment) => c.id));
      const allExistingIds = allCommentIdsRef.current;
      const isDuplicatePage = [...lastPageIds].every((id: string) => allExistingIds.has(id));

      if (isDuplicatePage && allExistingIds.size > 0) {
        console.warn("Duplicate page detected, stopping fetch.");
        return undefined;
      }

      return nextPageCursor;
    },
    initialPageParam: undefined,
    enabled: !!selectedVideo && !!pageId,
    refetchInterval: isAutoRefresh && isCommentsOpen ? 10000 : false,
  });

  const comments = useMemo(() => {
    const allComments = commentsData?.pages.flatMap(page => page.data) || [];
    // Deduplicate comments by ID to prevent rendering issues
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
      const newStatusMap = new Map(customerStatusMapRef.current);
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

      for (const comment of commentsNeedingTPOSFetch) {
        const order = orders.find(o => 
          o.Facebook_CommentId === comment.id || 
          (o.Facebook_ASUserId === comment.from.id && o.Facebook_UserName?.toLowerCase() === comment.from.name.toLowerCase())
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
          orderInfo: order,
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

      // Update state and ref
      customerStatusMapRef.current = newStatusMap;
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
  }, [toast]);

  // Debounced version
  const debouncedFetchStatus = useMemo(
    () => debounce(fetchPartnerStatusBatch, 500),
    [fetchPartnerStatusBatch]
  );

  // Process new comments only
  useEffect(() => {
    if (!comments.length || !ordersData.length) return;

    // Filter comments that don't have status yet using ref
    const commentsNeedingStatus = comments.filter(
      c => !customerStatusMapRef.current.has(c.from.id)
    );

    if (commentsNeedingStatus.length > 0) {
      console.log('[Effect] Found', commentsNeedingStatus.length, 'comments needing status');
      debouncedFetchStatus(commentsNeedingStatus, ordersData);
    }
  }, [comments, ordersData, debouncedFetchStatus]);

  // Count comments per user
  const userCommentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    comments.forEach(comment => {
      const userId = comment.from.id;
      counts.set(userId, (counts.get(userId) || 0) + 1);
    });
    return counts;
  }, [comments]);

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
    
    if (newIds.size > 0 && previousIds.size > 0) { // Only show toast if it's not the initial load
      setNewCommentIds(newIds);
      toast({
        title: `🔔 ${newIds.size} comment mới!`,
      });
      
      // Don't auto-scroll if the user is loading more.
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

  const filteredComments = useMemo(() => {
    return commentsWithStatus.filter(comment => {
      const matchesSearch = !searchQuery ||
        comment.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.from?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesOrderFilter = !showOnlyWithOrders || (comment.orderInfo && comment.orderInfo.Code);

      return matchesSearch && matchesOrderFilter;
    });
  }, [commentsWithStatus, searchQuery, showOnlyWithOrders]);

  const stats = {
    totalVideos: videos.length,
    liveVideos: videos.filter(v => v.statusLive === 1).length,
    totalComments: videos.reduce((sum, v) => sum + (v.countComment || 0), 0),
    totalReactions: videos.reduce((sum, v) => sum + (v.countReaction || 0), 0),
  };

  // New filtering logic for debug panel
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
    return comments.length >= selectedVideo.countComment;
  }, [comments, selectedVideo]);

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

            {/* Search & Filter */}
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
            </div>

            {/* Comments List */}
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
                            {/* Avatar placeholder with badge */}
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
                ? `Hiển thị ${filteredComments.length} / ${selectedVideo.countComment} comments`
                : `Hiển thị ${filteredComments.length} comments`
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

      <Dialog open={isCreateOrderResponseOpen} onOpenChange={setIsCreateOrderResponseOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>API Response: Tạo đơn hàng</DialogTitle>
            <DialogDescription>
              Đây là dữ liệu được gửi đi và nhận về từ TPOS API.
            </DialogDescription>
          </DialogHeader>
          {createOrderResponse && (
            <div className="space-y-4">
              {createOrderResponse.payload && (
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 bg-muted/50 hover:bg-muted/80">
                    <span className="font-semibold">Payload đã gửi</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-2 rounded-md border p-4">
                      <h4 className="font-semibold">Giải thích Payload</h4>
                      <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                        <li><code className="bg-muted px-1 rounded">Facebook_PostId</code>: Lấy từ <code className="bg-muted px-1 rounded">video.objectId</code>.</li>
                        <li><code className="bg-muted px-1 rounded">Facebook_ASUserId</code>: Lấy từ <code className="bg-muted px-1 rounded">comment.from.id</code>.</li>
                        <li><code className="bg-muted px-1 rounded">Facebook_UserName</code>, <code className="bg-muted px-1 rounded">Name</code>, <code className="bg-muted px-1 rounded">PartnerName</code>: Lấy từ <code className="bg-muted px-1 rounded">comment.from.name</code>.</li>
                        <li><code className="bg-muted px-1 rounded">Facebook_CommentId</code>: Lấy từ <code className="bg-muted px-1 rounded">comment.id</code>.</li>
                        <li><code className="bg-muted px-1 rounded">Facebook_Comments</code>: Chứa toàn bộ đối tượng <code className="bg-muted px-1 rounded">comment</code>.</li>
                        <li><code className="bg-muted px-1 rounded">Note</code>: Nội dung bình luận với tiền tố <code className="bg-muted px-1 rounded">{'{before}'}</code>.</li>
                        <li><code className="bg-muted px-1 rounded">DateCreated</code>: Thời gian hiện tại khi gửi request.</li>
                        <li>Các trường khác là giá trị cố định.</li>
                      </ul>
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(JSON.stringify(createOrderResponse.payload, null, 2))}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Payload
                        </Button>
                      </div>
                      <ScrollArea className="h-[300px] w-full rounded-md border">
                        <pre className="p-4 text-xs bg-muted">{JSON.stringify(createOrderResponse.payload, null, 2)}</pre>
                      </ScrollArea>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 bg-muted/50 hover:bg-muted/80">
                  <span className="font-semibold">Response nhận được</span>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="space-y-2 rounded-md border p-4">
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(JSON.stringify(createOrderResponse.data, null, 2))}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Response
                      </Button>
                    </div>
                    <ScrollArea className="h-[500px] w-full rounded-md border">
                      <pre className="p-4 text-xs bg-muted">{JSON.stringify(createOrderResponse.data, null, 2)}</pre>
                    </ScrollArea>
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
                <h3 className="font-semibold mb-2">1. Videos Response (`/facebook-livevideo`)</h3>
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
                <h3 className="font-semibold mb-2">2. Comments Response (`/facebook-comments`)</h3>
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
                <h3 className="font-semibold mb-2">3. TPOS Orders Response (`/fetch-facebook-orders`)</h3>
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