'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatNumber } from '@/lib/utils';

interface ChannelResult {
    channel_id: string;
    channel_name: string;
    channel_url: string;
    thumbnail_url?: string;
    subscriber_count?: number;
    video_count?: number;
    description?: string;
}

export default function SearchPage() {
    const [query, setQuery] = useState('');
    const [channels, setChannels] = useState<ChannelResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [adding, setAdding] = useState<Set<string>>(new Set());
    const [added, setAdded] = useState<Set<string>>(new Set());

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&minSubscribers=1000`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }

            setChannels(data.channels || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const handleAddChannel = async (channel: ChannelResult) => {
        setAdding(prev => new Set(prev).add(channel.channel_id));

        try {
            const response = await fetch('/api/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelData: channel,
                    source: 'search'
                }),
            });

            if (response.ok) {
                setAdded(prev => new Set(prev).add(channel.channel_id));
            } else {
                const data = await response.json();
                if (data.error === 'Channel already registered') {
                    setAdded(prev => new Set(prev).add(channel.channel_id));
                } else {
                    console.error('Failed to add channel:', data.error);
                }
            }
        } catch (err) {
            console.error('Error adding channel:', err);
        } finally {
            setAdding(prev => {
                const newSet = new Set(prev);
                newSet.delete(channel.channel_id);
                return newSet;
            });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black">
            {/* ヘッダー */}
            <header className="border-b border-gray-800/50 backdrop-blur-xl bg-gray-900/50 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center h-16">
                        <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <h1 className="ml-4 text-lg font-semibold text-white">チャンネルを検索</h1>
                    </div>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* 検索フォーム */}
                <form onSubmit={handleSearch} className="mb-8">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="検索キーワード（例：ゲーム実況）"
                            className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50"
                        >
                            {loading ? '検索中...' : '検索'}
                        </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                        登録者数1000人以上のチャンネルのみ表示されます（100ポイント消費）
                    </p>
                </form>

                {/* エラー表示 */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* 検索結果 */}
                {channels.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-medium text-white">
                            検索結果（{channels.length}件）
                        </h2>
                        <div className="grid gap-4">
                            {channels.map((channel) => (
                                <div
                                    key={channel.channel_id}
                                    className="bg-gray-800/50 backdrop-blur-xl rounded-xl border border-gray-700/50 p-4 flex items-center gap-4"
                                >
                                    {/* サムネイル */}
                                    {channel.thumbnail_url && (
                                        <img
                                            src={channel.thumbnail_url}
                                            alt={channel.channel_name}
                                            className="w-16 h-16 rounded-full object-cover"
                                        />
                                    )}

                                    {/* 情報 */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-medium truncate">
                                            {channel.channel_name}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                                            <span>登録者 {formatNumber(channel.subscriber_count || 0)}</span>
                                            <span>動画 {channel.video_count || 0}本</span>
                                        </div>
                                    </div>

                                    {/* 追加ボタン */}
                                    <button
                                        onClick={() => handleAddChannel(channel)}
                                        disabled={adding.has(channel.channel_id) || added.has(channel.channel_id)}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${added.has(channel.channel_id)
                                            ? 'bg-green-500/20 text-green-400 cursor-default'
                                            : adding.has(channel.channel_id)
                                                ? 'bg-gray-700 text-gray-400 cursor-wait'
                                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            }`}
                                    >
                                        {added.has(channel.channel_id)
                                            ? '追加済み'
                                            : adding.has(channel.channel_id)
                                                ? '追加中...'
                                                : '追加'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 空状態 */}
                {!loading && channels.length === 0 && query && (
                    <div className="text-center py-12">
                        <p className="text-gray-400">該当するチャンネルが見つかりませんでした</p>
                    </div>
                )}
            </main>
        </div>
    );
}
