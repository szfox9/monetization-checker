// フォルダ関連の型定義
export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

// チャンネル関連の型定義
export interface Channel {
  id: string;
  user_id: string;
  channel_id: string;
  channel_name: string;
  channel_url: string;
  custom_url?: string;
  thumbnail_url?: string;
  description?: string;
  subscriber_count?: number;
  video_count?: number;
  view_count?: number;
  country?: string;
  published_at?: string;
  keywords?: string[];
  topic_categories?: string[];
  is_monetized?: boolean;
  monetization_checked_at?: string;
  source?: string;
  folder_id?: string;
  created_at: string;
}

// YouTube API レスポンスの型定義
export interface YouTubeChannelSnippet {
  title: string;
  description: string;
  customUrl?: string;
  publishedAt: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
  country?: string;
}

export interface YouTubeChannelStatistics {
  viewCount: string;
  subscriberCount: string;
  hiddenSubscriberCount: boolean;
  videoCount: string;
}

export interface YouTubeChannelBrandingSettings {
  channel?: {
    keywords?: string;
  };
}

export interface YouTubeChannelTopicDetails {
  topicCategories?: string[];
}

export interface YouTubeChannel {
  kind: string;
  etag: string;
  id: string;
  snippet?: YouTubeChannelSnippet;
  statistics?: YouTubeChannelStatistics;
  brandingSettings?: YouTubeChannelBrandingSettings;
  topicDetails?: YouTubeChannelTopicDetails;
}

export interface YouTubeChannelListResponse {
  kind: string;
  etag: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeChannel[];
}

export interface YouTubeSearchResult {
  kind: string;
  etag: string;
  id: {
    kind: string;
    channelId?: string;
    videoId?: string;
    playlistId?: string;
  };
  snippet?: YouTubeChannelSnippet;
}

export interface YouTubeSearchListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeSearchResult[];
}

// 収益化チェック結果
export interface MonetizationCheckResult {
  isMonetized: boolean | null;
  checkedAt: string;
  indicators: {
    hasMembership: boolean;
    hasAds: boolean;
    hasSuperChat: boolean;
  };
}

// API レスポンスの型定義
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}
