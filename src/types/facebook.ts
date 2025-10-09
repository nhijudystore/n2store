export interface FacebookVideo {
  objectId: string;
  title: string;
  statusLive: 0 | 1;
  countComment: number;
  countReaction: number;
  channelCreatedTime: string;
  thumbnail?: {
    url: string;
  };
}

export interface FacebookComment {
  id: string;
  message: string;
  from: {
    name: string;
    id: string;
  };
  created_time: string;
  like_count: number;
}
