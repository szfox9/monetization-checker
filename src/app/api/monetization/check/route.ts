import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getMonetizationChecker } from '@/lib/youtube/scraper';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { channelId } = body;

        if (!channelId) {
            return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
        }

        const checker = getMonetizationChecker();
        const result = await checker.checkChannel(channelId);

        // データベースの収益化状態を更新
        await supabase
            .from('channels')
            .update({
                is_monetized: result.isMonetized,
                monetization_checked_at: result.checkedAt,
            })
            .eq('channel_id', channelId)
            .eq('user_id', user.id);

        return NextResponse.json({ result });
    } catch (error) {
        console.error('Error checking monetization:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
