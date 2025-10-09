import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Video, MessageCircle, Heart, RefreshCw, Pause, Play, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { FacebookVideo, FacebookComment, CommentWithStatus, TPOSOrder } from "@/types/facebook";

export function FacebookLiveComments() {
  const [pageId, setPageId] = useState("117267091364524");
  const [limit, setLimit] = useState("10");
  const [selectedVideo, setSelectedVideo] = useState<FacebookVideo | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [previousCommentIds, setPreviousCommentIds] = useState<Set<string>>(new Set());
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
  const [commentsWithStatus, setCommentsWithStatus] = useState<CommentWithStatus[]>([]);
  const [selectedOrderInfo, setSelectedOrderInfo] = useState<TPOSOrder | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      // API returns { data: [...] } structure, extract the array
      return (Array.isArray(result) ? result : result.data || []) as FacebookVideo[];
    },
    enabled: false,
  });

  // Fetch comments for selected video
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

  // Map StatusText to Vietnamese labels for database
  const mapStatusText = (statusText: string | null | undefined): string => {
    if (!statusText) return 'Bình thường';
    
    // Normalize the status text (handle both "Vip" and "VIP")
    const normalizedStatus = statusText.toLowerCase();
    if (normalizedStatus === 'vip') return 'VIP';
    
    // Return as-is if already Vietnamese, default to "Bình thường"
    const validStatuses = ['Bình thường', 'Bom hàng', 'Cảnh báo', 'Khách sỉ', 'Nguy hiểm', 'Thân thiết', 'VIP'];
    return validStatuses.includes(statusText) ? statusText : 'Bình thường';
  };

  // Fetch and process partner status for comments and save to customer database
  const fetchPartnerStatusBatch = useCallback(async (commentsToProcess: FacebookComment[]) => {
    if (!selectedVideo?.objectId || commentsToProcess.length === 0) return;

    try {
      // Step 1: Check existing customers in database first
      const facebookIds = commentsToProcess.map(c => c.from.id);
      const { data: existingCustomers = [] } = await supabase
        .from('customers')
        .select('*')
        .in('facebook_id', facebookIds);
      
      const existingCustomersMap = new Map(existingCustomers.map(c => [c.facebook_id, c]));
      
      // Separate comments: already in DB (don't fetch) vs completely new (need to fetch)
      const commentsNeedingFetch: FacebookComment[] = [];
      
      for (const comment of commentsToProcess) {
        const existing = existingCustomersMap.get(comment.from.id);
        if (!existing) {
          // Completely new customer - need to fetch
          commentsNeedingFetch.push(comment);
        }
        // If already in DB (complete or incomplete) - don't fetch, use existing data
      }

      // Step 2: Fetch orders only for comments that need updating
      const { data: { session } } = await supabase.auth.getSession();
      
      let orders: TPOSOrder[] = [];
      if (commentsNeedingFetch.length > 0) {
        const ordersResponse = await fetch(`https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/fetch-facebook-orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ postId: selectedVideo.objectId, top: 100 }),
        });

        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          orders = ordersData.value || [];
        }
      }

      // Step 3: Map comments needing fetch to orders and collect phone numbers
      const commentOrderMap = new Map<string, TPOSOrder>();
      const phoneNumbers: string[] = [];
      const commentPhoneMap = new Map<string, string>(); // comment id to phone

      for (const comment of commentsNeedingFetch) {
        // Find order by comment ID or user name
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

      // Step 4: Batch fetch partner status (10 at a time) only for comments needing update
      const partnerStatusMap = new Map<string, string>();
      
      for (let i = 0; i < phoneNumbers.length; i += 10) {
        const batch = phoneNumbers.slice(i, i + 10);
        
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

          // Match partners with comments by name and phone
          for (const comment of commentsNeedingFetch) {
            const order = commentOrderMap.get(comment.id);
            const phone = commentPhoneMap.get(comment.id);
            
            if (phone && order) {
              // Find first matching partner (most recent by DateCreated desc)
              const matchingPartner = partners.find(
                (p: any) => p.Name === order.Name && p.Phone === phone
              );
              
              if (matchingPartner?.StatusText) {
                partnerStatusMap.set(comment.id, matchingPartner.StatusText);
              }
            }
          }
        }
      }

      // Step 5: Save/update customers to database (only NEW customers that were fetched)
      for (const comment of commentsNeedingFetch) {
        const order = commentOrderMap.get(comment.id);
        const partnerStatus = partnerStatusMap.get(comment.id);
        const phone = commentPhoneMap.get(comment.id);
        
        try {
          const customerData = order && phone ? {
            customer_name: order.Name,
            phone: phone,
            facebook_id: comment.from.id,
            customer_status: mapStatusText(partnerStatus),
            info_status: partnerStatus ? 'complete' : 'incomplete',
          } : {
            customer_name: comment.from.name,
            phone: null,
            facebook_id: comment.from.id,
            customer_status: 'normal',
            info_status: 'incomplete',
          };

          // Check if customer already exists
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('facebook_id', comment.from.id)
            .maybeSingle();

          if (existing) {
            // Update existing customer
            await supabase
              .from('customers')
              .update(customerData)
              .eq('facebook_id', comment.from.id);
          } else {
            // Insert new customer
            await supabase
              .from('customers')
              .insert(customerData);
          }
        } catch (error) {
          console.error('Error saving customer:', error);
        }
      }

      // Step 6: Update comments with status and order info
      setCommentsWithStatus(prev => {
        const updated = [...prev];
        for (const comment of commentsToProcess) {
          const index = updated.findIndex(c => c.id === comment.id);
          if (index >= 0) {
            const existingCustomer = existingCustomersMap.get(comment.from.id);
            
            if (existingCustomer) {
              // Customer already in database - use existing data
              // Show customer status if they have a phone (meaning we have their info)
              const hasCompleteInfo = !!existingCustomer.phone;
              const statusText = (existingCustomer.info_status === 'complete' || hasCompleteInfo)
                ? existingCustomer.customer_status 
                : 'Cần thêm TT';
              
              updated[index] = {
                ...updated[index],
                partnerStatus: statusText,
                orderInfo: existingCustomer.phone ? { Telephone: existingCustomer.phone } as any : undefined,
                isLoadingStatus: false,
              };
            } else {
              // New customer - use fetched data
              updated[index] = {
                ...updated[index],
                partnerStatus: partnerStatusMap.get(comment.id) || 'Chưa có TT',
                orderInfo: commentOrderMap.get(comment.id),
                isLoadingStatus: false,
              };
            }
          }
        }
        return updated;
      });
    } catch (error) {
      console.error('Error fetching partner status:', error);
    }
  }, [selectedVideo]);

  // Process comments when they change
  useEffect(() => {
    if (comments.length === 0) return;

    // Initialize comments with status
    const newComments: CommentWithStatus[] = comments.map(c => ({
      ...c,
      partnerStatus: 'Khách lạ',
      isLoadingStatus: true,
    }));

    setCommentsWithStatus(newComments);

    // Fetch partner status for all comments
    fetchPartnerStatusBatch(comments);
  }, [comments, fetchPartnerStatusBatch]);

  // Track new comments and scroll to top
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
        
        // Scroll to top to show new comments
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
        
        // Clear new badges after 3 seconds
        setTimeout(() => {
          setNewCommentIds(new Set());
        }, 3000);
      }
    }
    
    setPreviousCommentIds(currentIds);
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
    setPreviousCommentIds(new Set());
    setNewCommentIds(new Set());
    setSearchQuery("");
    setDisplayLimit(20);
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

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;
    
    // Load more when scrolled 80%
    if (scrollPercentage > 0.8 && displayLimit < filteredComments.length) {
      setDisplayLimit(prev => Math.min(prev + 20, filteredComments.length));
    }
  }, []);

  const filteredComments = commentsWithStatus.filter(comment =>
    comment.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.from?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedComments = filteredComments.slice(0, displayLimit);

  const stats = {
    totalVideos: videos.length,
    liveVideos: videos.filter(v => v.statusLive === 1).length,
    totalComments: videos.reduce((sum, v) => sum + (v.countComment || 0), 0),
    totalReactions: videos.reduce((sum, v) => sum + (v.countReaction || 0), 0),
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Tính Năng Facebook Live Comments</CardTitle>
          <CardDescription>
            Xem và theo dõi comments từ Facebook Live videos
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
