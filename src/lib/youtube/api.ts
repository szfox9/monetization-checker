import {
    YouTubeChannelListResponse,
    YouTubeSearchListResponse,
    YouTubeChannel,
} from '@/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * YouTube Data API v3 のラッパー
 */
export class YouTubeAPI {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * チャンネルIDからチャンネル情報を取得
     * クォータ消費: 1ポイント
     */
    async getChannelById(channelId: string): Promise<YouTubeChannel | null> {
        const params = new URLSearchParams({
            part: 'snippet,statistics,brandingSettings,topicDetails,contentDetails',
            id: channelId,
            key: this.apiKey,
        });

        const response = await fetch(
            `${YOUTUBE_API_BASE}/channels?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }

        const data: YouTubeChannelListResponse = await response.json();
        return data.items?.[0] || null;
    }

    /**
     * チャンネルURLからチャンネルIDを抽出して情報を取得
     */
    async getChannelByUrl(url: string): Promise<YouTubeChannel | null> {
        // URLエンコードされた日本語などをデコード
        const decodedUrl = decodeURIComponent(url);

        const channelId = this.extractChannelId(decodedUrl);
        if (!channelId) {
            // ハンドル(@username)の場合は検索で取得
            const handle = this.extractHandle(decodedUrl);
            if (handle) {
                return this.getChannelByHandle(handle);
            }
            return null;
        }
        return this.getChannelById(channelId);
    }

    /**
     * @ハンドルからチャンネル情報を取得
     * クォータ消費: 1ポイント
     */
    async getChannelByHandle(handle: string): Promise<YouTubeChannel | null> {
        const params = new URLSearchParams({
            part: 'snippet,statistics,brandingSettings,topicDetails,contentDetails',
            forHandle: handle.replace('@', ''),
            key: this.apiKey,
        });

        const response = await fetch(
            `${YOUTUBE_API_BASE}/channels?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }

        const data: YouTubeChannelListResponse = await response.json();
        return data.items?.[0] || null;
    }

    /**
     * キーワードでチャンネルを検索
     * クォータ消費: 100ポイント
     */
    async searchChannels(
        query: string,
        maxResults: number = 25,
        pageToken?: string
    ): Promise<YouTubeSearchListResponse> {
        const params = new URLSearchParams({
            part: 'snippet',
            type: 'channel',
            q: query,
            maxResults: maxResults.toString(),
            key: this.apiKey,
        });

        if (pageToken) {
            params.append('pageToken', pageToken);
        }

        const response = await fetch(
            `${YOUTUBE_API_BASE}/search?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * 複数のチャンネルIDから詳細情報を一括取得
     * クォータ消費: 1ポイント（最大50チャンネルまで）
     */
    async getChannelsByIds(channelIds: string[]): Promise<YouTubeChannel[]> {
        if (channelIds.length === 0) return [];
        if (channelIds.length > 50) {
            throw new Error('Maximum 50 channels per request');
        }

        const params = new URLSearchParams({
            part: 'snippet,statistics,brandingSettings,topicDetails,contentDetails',
            id: channelIds.join(','),
            key: this.apiKey,
        });

        const response = await fetch(
            `${YOUTUBE_API_BASE}/channels?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }

        const data: YouTubeChannelListResponse = await response.json();
        return data.items || [];
    }

    /**
     * チャンネルの最新動画を取得（アップロードプレイリストから）
     * クォータ消費: 1ポイント
     */
    async getLatestVideos(
        uploadsPlaylistId: string,
        maxResults: number = 5
    ): Promise<{ videoId: string; publishedAt: string; title: string }[]> {
        const params = new URLSearchParams({
            part: 'snippet',
            playlistId: uploadsPlaylistId,
            maxResults: maxResults.toString(),
            key: this.apiKey,
        });

        const response = await fetch(
            `${YOUTUBE_API_BASE}/playlistItems?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }

        const data = await response.json();
        return (
            data.items?.map(
                (item: {
                    snippet: {
                        resourceId: { videoId: string };
                        publishedAt: string;
                        title: string;
                    };
                }) => ({
                    videoId: item.snippet.resourceId.videoId,
                    publishedAt: item.snippet.publishedAt,
                    title: item.snippet.title,
                })
            ) || []
        );
    }

    /**
     * URLからチャンネルIDを抽出
     */
    private extractChannelId(url: string): string | null {
        // パターン: youtube.com/channel/UC...
        const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
        if (channelMatch) return channelMatch[1];

        return null;
    }

    /**
     * URLからハンドル（@username）を抽出
     */
    private extractHandle(url: string): string | null {
        // パターン: youtube.com/@username（日本語を含む場合も対応）
        const handleMatch = url.match(/youtube\.com\/@([^\/\?&]+)/);
        if (handleMatch) return handleMatch[1];

        // パターン: youtube.com/c/channelname または youtube.com/user/username
        const customMatch = url.match(/youtube\.com\/(?:c|user)\/([^\/\?&]+)/);
        if (customMatch) return customMatch[1];

        return null;
    }
}

/**
 * YouTubeチャンネルのデータをアプリ用の形式に変換
 */
export function convertYouTubeChannel(
    channel: YouTubeChannel,
    source: 'manual' | 'search' = 'manual'
) {
    const keywords = channel.brandingSettings?.channel?.keywords
        ? channel.brandingSettings.channel.keywords.split(/[,\s]+/).filter(Boolean)
        : undefined;

    return {
        channel_id: channel.id,
        channel_name: channel.snippet?.title || 'Unknown Channel',
        channel_url: `https://www.youtube.com/channel/${channel.id}`,
        custom_url: channel.snippet?.customUrl,
        thumbnail_url: channel.snippet?.thumbnails?.high?.url ||
            channel.snippet?.thumbnails?.medium?.url ||
            channel.snippet?.thumbnails?.default?.url,
        description: channel.snippet?.description,
        subscriber_count: parseInt(channel.statistics?.subscriberCount || '0', 10),
        video_count: parseInt(channel.statistics?.videoCount || '0', 10),
        view_count: parseInt(channel.statistics?.viewCount || '0', 10),
        country: channel.snippet?.country,
        published_at: channel.snippet?.publishedAt,
        keywords,
        topic_categories: channel.topicDetails?.topicCategories,
        source,
    };
}
