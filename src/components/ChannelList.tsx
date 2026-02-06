'use client';

import { useState } from 'react';
import { Channel, Folder } from '@/types';
import { formatNumber, getRelativeTime } from '@/lib/utils';
import Link from 'next/link';

// 認識しやすいカラーパレット
const FOLDER_COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#6366f1', // indigo
];

interface ChannelListProps {
    initialChannels: Channel[];
    initialFolders: Folder[];
}

export default function ChannelList({ initialChannels, initialFolders }: ChannelListProps) {
    const [channels, setChannels] = useState(initialChannels);
    const [folders, setFolders] = useState(initialFolders);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [movingChannel, setMovingChannel] = useState<string | null>(null);
    const [checkingChannel, setCheckingChannel] = useState<string | null>(null);
    const [deletingChannel, setDeletingChannel] = useState<string | null>(null);
    const [editingFolder, setEditingFolder] = useState<string | null>(null);
    const [editFolderName, setEditFolderName] = useState('');

    // 次に使う色を取得
    const getNextColor = () => {
        const usedColors = folders.map(f => f.color);
        const available = FOLDER_COLORS.filter(c => !usedColors.includes(c));
        return available.length > 0 ? available[0] : FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
    };

    // フィルタリングされたチャンネル
    const filteredChannels = selectedFolder === null
        ? channels
        : selectedFolder === 'uncategorized'
            ? channels.filter(c => !c.folder_id)
            : channels.filter(c => c.folder_id === selectedFolder);

    // フォルダ作成
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFolderName, color: getNextColor() }),
            });

            if (response.ok) {
                const { folder } = await response.json();
                setFolders([...folders, folder]);
                setNewFolderName('');
                setShowNewFolderInput(false);
            }
        } catch (error) {
            console.error('Error creating folder:', error);
        }
    };

    // フォルダ名変更
    const handleRenameFolder = async (folderId: string) => {
        if (!editFolderName.trim()) {
            setEditingFolder(null);
            return;
        }
        try {
            const response = await fetch('/api/folders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: folderId, name: editFolderName }),
            });
            if (response.ok) {
                const { folder } = await response.json();
                setFolders(folders.map(f => f.id === folderId ? folder : f));
            }
        } catch (error) {
            console.error('Error renaming folder:', error);
        } finally {
            setEditingFolder(null);
        }
    };

    // フォルダ削除
    const handleDeleteFolder = async (folderId: string, folderName: string) => {
        if (!confirm(`フォルダ「${folderName}」を削除しますか？\n中のチャンネルは未分類に移動します。`)) return;
        try {
            const response = await fetch(`/api/folders?id=${folderId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                setFolders(folders.filter(f => f.id !== folderId));
                setChannels(channels.map(c => c.folder_id === folderId ? { ...c, folder_id: undefined } : c));
                if (selectedFolder === folderId) setSelectedFolder(null);
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
        }
    };

    // チャンネルをフォルダに移動
    const handleMoveChannel = async (channelId: string, folderId: string | null) => {
        try {
            const response = await fetch('/api/channels/move', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, folderId }),
            });

            if (response.ok) {
                setChannels(channels.map(c =>
                    c.id === channelId ? { ...c, folder_id: folderId || undefined } : c
                ));
            }
        } catch (error) {
            console.error('Error moving channel:', error);
        } finally {
            setMovingChannel(null);
        }
    };

    // フォルダ内のチャンネル数を取得
    const getChannelCount = (folderId: string | null) => {
        if (folderId === null) return channels.length;
        if (folderId === 'uncategorized') return channels.filter(c => !c.folder_id).length;
        return channels.filter(c => c.folder_id === folderId).length;
    };

    // CSVエクスポート
    const handleExportCSV = () => {
        const headers = ['チャンネル名', 'チャンネルURL', '登録者数', '動画数', '収益化状態', '最終チェック日', 'フォルダ'];
        const rows = filteredChannels.map(channel => {
            const folder = folders.find(f => f.id === channel.folder_id);
            const monetizationStatus = channel.is_monetized === true ? '収益化済み' : channel.is_monetized === false ? '未収益化' : '未チェック';
            const checkedAt = channel.monetization_checked_at ? new Date(channel.monetization_checked_at).toLocaleString('ja-JP') : '-';
            return [
                channel.channel_name,
                channel.channel_url,
                channel.subscriber_count?.toString() || '0',
                channel.video_count?.toString() || '0',
                monetizationStatus,
                checkedAt,
                folder?.name || '未分類'
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `channels_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // 収益化状態を再チェック
    const handleRecheckMonetization = async (channel: Channel) => {
        setCheckingChannel(channel.id);

        try {
            const response = await fetch('/api/monetization/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: channel.channel_id }),
            });

            if (response.ok) {
                const { result } = await response.json();
                setChannels(channels.map(c =>
                    c.id === channel.id
                        ? { ...c, is_monetized: result.isMonetized, monetization_checked_at: result.checkedAt }
                        : c
                ));
            }
        } catch (error) {
            console.error('Error checking monetization:', error);
        } finally {
            setCheckingChannel(null);
        }
    };

    return (
        <div className="flex gap-6">
            {/* サイドバー（フォルダ一覧） */}
            <div className="w-64 flex-shrink-0">
                <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl border border-gray-700/50 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-300">フォルダ</h3>
                        <button
                            onClick={() => setShowNewFolderInput(true)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>

                    {/* 新規フォルダ入力 */}
                    {showNewFolderInput && (
                        <div className="mb-3 flex gap-2">
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="フォルダ名"
                                className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            />
                            <button
                                onClick={handleCreateFolder}
                                className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
                            >
                                追加
                            </button>
                        </div>
                    )}

                    {/* フォルダリスト */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setSelectedFolder(null)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${selectedFolder === null ? 'bg-gray-700/50 text-white' : 'text-gray-400 hover:bg-gray-700/30 hover:text-white'
                                }`}
                        >
                            <span className="text-sm">すべて</span>
                            <span className="text-xs text-gray-500">{getChannelCount(null)}</span>
                        </button>

                        <button
                            onClick={() => setSelectedFolder('uncategorized')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${selectedFolder === 'uncategorized' ? 'bg-gray-700/50 text-white' : 'text-gray-400 hover:bg-gray-700/30 hover:text-white'
                                }`}
                        >
                            <span className="text-sm">未分類</span>
                            <span className="text-xs text-gray-500">{getChannelCount('uncategorized')}</span>
                        </button>

                        {folders.map((folder) => (
                            <div
                                key={folder.id}
                                className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${selectedFolder === folder.id ? 'bg-gray-700/50 text-white' : 'text-gray-400 hover:bg-gray-700/30 hover:text-white'
                                    }`}
                            >
                                {editingFolder === folder.id ? (
                                    <div className="flex-1 flex gap-2">
                                        <input
                                            type="text"
                                            value={editFolderName}
                                            onChange={(e) => setEditFolderName(e.target.value)}
                                            className="flex-1 px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRenameFolder(folder.id);
                                                if (e.key === 'Escape') setEditingFolder(null);
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => handleRenameFolder(folder.id)}
                                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                                        >
                                            保存
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setSelectedFolder(folder.id)}
                                            className="flex-1 min-w-0 flex items-center gap-2 text-left"
                                        >
                                            <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: folder.color }} />
                                            <span className="text-sm truncate max-w-[100px]">{folder.name}</span>
                                        </button>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-xs text-gray-500 mr-1">{getChannelCount(folder.id)}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditFolderName(folder.name);
                                                    setEditingFolder(folder.id);
                                                }}
                                                className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="名前を変更"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFolder(folder.id, folder.name);
                                                }}
                                                className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="削除"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* メインコンテンツ（チャンネル一覧） */}
            <div className="flex-1">
                {filteredChannels.length > 0 ? (
                    <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl border border-gray-700/50">
                        <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">
                                {selectedFolder === null ? 'すべてのチャンネル' :
                                    selectedFolder === 'uncategorized' ? '未分類' :
                                        folders.find(f => f.id === selectedFolder)?.name || 'チャンネル'}
                                <span className="ml-2 text-sm text-gray-400">({filteredChannels.length}件)</span>
                            </h2>
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                CSVエクスポート
                            </button>
                        </div>
                        <div className="divide-y divide-gray-700/50">
                            {filteredChannels.map((channel) => (
                                <div key={channel.id} className="p-4 flex items-center gap-4 hover:bg-gray-700/20 transition-colors">
                                    {/* サムネイル */}
                                    {channel.thumbnail_url ? (
                                        <img
                                            src={channel.thumbnail_url}
                                            alt={channel.channel_name}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    )}

                                    {/* チャンネル情報 */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-medium truncate">{channel.channel_name}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                            <span>登録者 {formatNumber(channel.subscriber_count || 0)}</span>
                                            <span>動画 {channel.video_count || 0}本</span>
                                            {channel.monetization_checked_at && (
                                                <span className="text-gray-500">
                                                    チェック: {getRelativeTime(channel.monetization_checked_at)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 収益化ステータス */}
                                    <div className="flex items-center gap-2">
                                        {channel.is_monetized === true ? (
                                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full">
                                                収益化済み
                                            </span>
                                        ) : channel.is_monetized === false ? (
                                            <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm font-medium rounded-full">
                                                未収益化
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-sm font-medium rounded-full">
                                                未チェック
                                            </span>
                                        )}
                                        {/* 再チェックボタン */}
                                        <button
                                            onClick={() => handleRecheckMonetization(channel)}
                                            disabled={checkingChannel === channel.id}
                                            className="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                                            title="収益化を再チェック"
                                        >
                                            {checkingChannel === channel.id ? (
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>

                                    {/* フォルダ移動 */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setMovingChannel(movingChannel === channel.id ? null : channel.id)}
                                            className="p-2 text-gray-400 hover:text-white transition-colors"
                                            title="フォルダに移動"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                        </button>

                                        {/* フォルダ選択ドロップダウン */}
                                        {movingChannel === channel.id && (
                                            <div className="absolute right-0 top-10 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
                                                <div className="p-2 space-y-1">
                                                    <button
                                                        onClick={() => handleMoveChannel(channel.id, null)}
                                                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded-lg"
                                                    >
                                                        未分類に移動
                                                    </button>
                                                    {folders.map((folder) => (
                                                        <button
                                                            key={folder.id}
                                                            onClick={() => handleMoveChannel(channel.id, folder.id)}
                                                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded-lg flex items-center gap-2"
                                                        >
                                                            <div className="w-3 h-3 rounded" style={{ backgroundColor: folder.color }} />
                                                            {folder.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* リンク */}
                                    <a
                                        href={channel.channel_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>

                                    {/* 削除ボタン */}
                                    <button
                                        onClick={async () => {
                                            if (!confirm(`「${channel.channel_name}」を削除しますか？`)) return;
                                            setDeletingChannel(channel.id);
                                            try {
                                                const response = await fetch(`/api/channels?id=${channel.id}`, {
                                                    method: 'DELETE',
                                                });
                                                if (response.ok) {
                                                    setChannels(channels.filter(c => c.id !== channel.id));
                                                }
                                            } catch (error) {
                                                console.error('Error deleting channel:', error);
                                            } finally {
                                                setDeletingChannel(null);
                                            }
                                        }}
                                        disabled={deletingChannel === channel.id}
                                        className="p-2 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                        title="削除"
                                    >
                                        {deletingChannel === channel.id ? (
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl border border-gray-700/50 p-8">
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">チャンネルがありません</h3>
                            <p className="text-gray-400 mb-6">
                                チャンネルを追加して、収益化状態をチェックしましょう
                            </p>
                            <Link
                                href="/channels/add"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl transition-all duration-200"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                最初のチャンネルを追加
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
