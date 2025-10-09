import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Video, MessageCircle, Heart, RefreshCw, Pause, Play, Search } from "lucide-react";
import { format } from "date-fns";
import type { FacebookVideo, FacebookComment } from "@/types/facebook";

export function FacebookLiveComments() {
  const [pageId, setPageId] = useState("117267091364524");
  const [limit, setLimit] = useState("10");
  const [selectedVideo, setSelectedVideo] = useState<FacebookVideo | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [previousCommentIds, setPreviousCommentIds] = useState<Set<string>>(new Set());
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
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
      
      const url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${selectedVideo.objectId}&limit=100`;
      
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
      // API returns array directly or { data: [...] } structure
      return (Array.isArray(result) ? result : result.data || []) as FacebookComment[];
    },
    enabled: !!selectedVideo && !!pageId,
    refetchInterval: isAutoRefresh && isCommentsOpen ? 10000 : false,
  });

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
  };

  const filteredComments = comments.filter(comment =>
    comment.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.from?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
              <div className="space-y-4">
                {filteredComments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {searchQuery ? "Không tìm thấy comment nào" : "Chưa có comment"}
                  </div>
                ) : (
                  filteredComments.map((comment) => {
                    const isNew = newCommentIds.has(comment.id);
                    // Generate a simple status based on comment content (for display only)
                    // Default status is "Khách lạ" (strange customer) for people without data
                    const hasWarningKeyword = comment.message?.toLowerCase().includes('cảnh báo') || 
                                             comment.message?.toLowerCase().includes('warning');
                    const partnerStatus = hasWarningKeyword ? 'warning' : 'stranger';
                    
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
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  Thông tin
                                </Button>
                                <Badge 
                                  variant="secondary"
                                  className={partnerStatus === 'warning' 
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                                  }
                                >
                                  {partnerStatus === 'warning' ? 'Cảnh báo' : 'Khách lạ'}
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
              </div>
            </ScrollArea>

            <div className="text-sm text-muted-foreground text-center">
              Hiển thị {filteredComments.length} / {comments.length} comments
              {isAutoRefresh && " • Auto-refresh mỗi 10s"}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
