import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { YouTubeAPI, convertYouTubeChannel } from '@/lib/youtube/api';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const pageToken = searchParams.get('pageToken') || undefined;
        const minSubscribers = parseInt(searchParams.get('minSubscribers') || '1000', 10);

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
        }

        const youtubeApi = new YouTubeAPI(apiKey);

        // チャンネルを検索
        const searchResults = await youtubeApi.searchChannels(query, 25, pageToken);

        // チャンネルIDを抽出
        const channelIds = searchResults.items
            .map(item => item.snippet.channelId)
            .filter(Boolean);

        if (channelIds.length === 0) {
            return NextResponse.json({
                channels: [],
                nextPageToken: searchResults.nextPageToken,
                totalResults: searchResults.pageInfo.totalResults,
            });
        }

        // チャンネルの詳細情報を取得
        const channelDetails = await youtubeApi.getChannelsByIds(channelIds);

        // 登録者数でフィルタリングして変換
        const channels = channelDetails
            .filter(channel => {
                const subscribers = parseInt(channel.statistics.subscriberCount, 10);
                return subscribers >= minSubscribers;
            })
            .map(channel => convertYouTubeChannel(channel, 'search'));

        return NextResponse.json({
            channels,
            nextPageToken: searchResults.nextPageToken,
            totalResults: searchResults.pageInfo.totalResults,
        });
    } catch (error) {
        console.error('Error searching channels:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
