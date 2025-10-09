import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Video, MessageCircle, Heart, RefreshCw, Pause, Play, Search } from "lucide-react";
import { format } from "date-fns";
import type { FacebookVideo, FacebookComment } from "@/types/facebook";

export function FacebookLiveComments() {
  const [pageId, setPageId] = useState("");
  const [limit, setLimit] = useState("10");
  const [selectedVideo, setSelectedVideo] = useState<FacebookVideo | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [previousCommentCount, setPreviousCommentCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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

      return await response.json() as FacebookVideo[];
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

      return await response.json() as FacebookComment[];
    },
    enabled: !!selectedVideo && !!pageId,
    refetchInterval: isAutoRefresh && isCommentsOpen ? 10000 : false,
  });

  // Track new comments
  useEffect(() => {
    if (comments.length > previousCommentCount && previousCommentCount > 0) {
      toast.success(`${comments.length - previousCommentCount} comment mới!`);
    }
    setPreviousCommentCount(comments.length);
  }, [comments.length]);

  // Auto scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current && isAutoRefresh) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments, isAutoRefresh]);

  const handleLoadVideos = async () => {
    if (!pageId) {
      toast.error("Vui lòng nhập Page ID");
      return;
    }
    
    try {
      await refetchVideos();
      toast.success("Đã tải videos thành công!");
    } catch (error: any) {
      toast.error("Lỗi khi tải videos: " + error.message);
    }
  };

  const handleVideoClick = (video: FacebookVideo) => {
    setSelectedVideo(video);
    setIsCommentsOpen(true);
    setPreviousCommentCount(0);
    setSearchQuery("");
  };

  const filteredComments = comments.filter(comment =>
    comment.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.from?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalVideos: videos.length,
    liveVideos: videos.filter(v => v.statusLive === 1).length,
    totalComments: videos.reduce((sum, v) => sum + v.countComment, 0),
    totalReactions: videos.reduce((sum, v) => sum + v.countReaction, 0),
  };

  const newCommentsCount = comments.length - previousCommentCount;

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
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleVideoClick(video)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-2">
                        {video.title}
                      </CardTitle>
                      {video.statusLive === 1 && (
                        <Badge variant="destructive" className="shrink-0">LIVE</Badge>
                      )}
                    </div>
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
              {newCommentsCount > 0 && (
                <Badge variant="default" className="ml-auto">
                  {newCommentsCount} mới
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
                  filteredComments.map((comment, index) => {
                    const isNew = index >= previousCommentCount;
                    return (
                      <Card
                        key={comment.id}
                        className={isNew ? "border-primary bg-primary/5 animate-in fade-in slide-in-from-bottom-2" : ""}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-semibold text-sm">
                                {comment.from?.name}
                                {isNew && (
                                  <Badge variant="default" className="ml-2">NEW</Badge>
                                )}
                              </div>
                              <p className="text-sm mt-1">{comment.message}</p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{format(new Date(comment.created_time), 'HH:mm dd/MM/yyyy')}</span>
                                {comment.like_count > 0 && (
                                  <span className="flex items-center gap-1">
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
