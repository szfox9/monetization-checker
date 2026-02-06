import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// チャンネルをフォルダに移動
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { channelId, folderId } = body;

        if (!channelId) {
            return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
        }

        const { data: channel, error } = await supabase
            .from('channels')
            .update({ folder_id: folderId || null })
            .eq('id', channelId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ channel });
    } catch (error) {
        console.error('Error moving channel:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
