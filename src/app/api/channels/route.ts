import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { YouTubeAPI, convertYouTubeChannel } from '@/lib/youtube/api';
import { getMonetizationChecker } from '@/lib/youtube/scraper';

// チャンネル一覧を取得
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: channels, error } = await supabase
            .from('channels')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ channels });
    } catch (error) {
        console.error('Error fetching channels:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// チャンネルを追加
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { url, channelData: directChannelData, source = 'manual' } = body;

        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
        }

        const youtubeApi = new YouTubeAPI(apiKey);
        let channelInfo;
        let channelId: string;

        // 検索結果から直接データが渡された場合
        if (directChannelData && directChannelData.channel_id) {
            channelId = directChannelData.channel_id;
            channelInfo = {
                channel_id: directChannelData.channel_id,
                channel_name: directChannelData.channel_name,
                channel_url: directChannelData.channel_url,
                custom_url: directChannelData.custom_url,
                thumbnail_url: directChannelData.thumbnail_url,
                description: directChannelData.description,
                subscriber_count: directChannelData.subscriber_count,
                video_count: directChannelData.video_count,
                view_count: directChannelData.view_count,
                country: directChannelData.country,
                published_at: directChannelData.published_at,
                keywords: directChannelData.keywords,
                topic_categories: directChannelData.topic_categories,
                source,
            };
        } else if (url) {
            // URLからチャンネル情報を取得
            const channelData = await youtubeApi.getChannelByUrl(url);
            if (!channelData) {
                return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
            }
            channelId = channelData.id;
            channelInfo = convertYouTubeChannel(channelData, source);
        } else {
            return NextResponse.json({ error: 'URL or channelData is required' }, { status: 400 });
        }

        // 重複チェック
        const { data: existing } = await supabase
            .from('channels')
            .select('id')
            .eq('user_id', user.id)
            .eq('channel_id', channelId)
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Channel already registered' }, { status: 409 });
        }

        // 収益化状態をチェック（エラーが起きても続行）
        let isMonetized = null;
        let monetizationCheckedAt = null;
        try {
            const checker = getMonetizationChecker();
            const monetizationResult = await checker.checkChannel(channelId);
            isMonetized = monetizationResult.isMonetized;
            monetizationCheckedAt = monetizationResult.checkedAt;
        } catch (error) {
            console.error('Monetization check failed:', error);
            // 収益化チェックが失敗しても登録は続行
        }

        // データベースに保存
        const { data: channel, error } = await supabase
            .from('channels')
            .insert({
                user_id: user.id,
                ...channelInfo,
                is_monetized: isMonetized,
                monetization_checked_at: monetizationCheckedAt,
            })
            .select()
            .single();

        if (error) {
            console.error('Database insert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ channel });
    } catch (error) {
        console.error('Error adding channel:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// チャンネルを削除
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('channels')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting channel:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
