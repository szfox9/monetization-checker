import * as cheerio from 'cheerio';
import { MonetizationCheckResult } from '@/types';

/**
 * YouTubeチャンネルの収益化状態をスクレイピングで判定
 */
export class MonetizationChecker {
    /**
     * チャンネルの収益化状態をチェック
     * 複数の指標を組み合わせて判定
     */
    async checkChannel(channelId: string): Promise<MonetizationCheckResult> {
        try {
            // チャンネルページをチェック
            const channelResult = await this.checkChannelPage(channelId);

            // 動画ページで広告の有無をチェック
            const videoResult = await this.checkVideoPage(channelId);

            // 結果を統合
            const isMonetized = channelResult.hasMembership || videoResult.hasAds;

            // デバッグログ
            console.log(`[Monetization Check] Channel: ${channelId}`);
            console.log(`  - Membership: ${channelResult.hasMembership}`);
            console.log(`  - Ads: ${videoResult.hasAds}`);
            console.log(`  - Result: ${isMonetized ? 'MONETIZED' : 'NOT MONETIZED'}`);

            return {
                isMonetized,
                checkedAt: new Date().toISOString(),
                indicators: {
                    hasMembership: channelResult.hasMembership,
                    hasAds: videoResult.hasAds,
                    hasSuperChat: false, // 現在は未実装
                },
            };
        } catch (error) {
            console.error('Monetization check error:', error);
            return {
                isMonetized: null,
                checkedAt: new Date().toISOString(),
                indicators: {
                    hasMembership: false,
                    hasAds: false,
                    hasSuperChat: false,
                },
            };
        }
    }

    /**
     * チャンネルページからメンバーシップボタンの有無を確認
     */
    private async checkChannelPage(channelId: string): Promise<{ hasMembership: boolean }> {
        try {
            const url = `https://www.youtube.com/channel/${channelId}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ja,en;q=0.9',
                },
            });

            if (!response.ok) {
                return { hasMembership: false };
            }

            const html = await response.text();

            // メンバーシップボタンの存在を確認（元の検出パターン）
            const hasMembership =
                html.includes('"sponsorButton"') ||
                html.includes('メンバーになる') ||
                html.includes('"Join"') ||
                html.includes('sponsorshipButton');

            console.log(`[Membership Check] Channel ${channelId}: ${hasMembership}`);
            return { hasMembership };
        } catch (error) {
            console.error(`[Membership Check Error] Channel ${channelId}:`, error);
            return { hasMembership: false };
        }
    }

    /**
     * 動画ページから広告の有無を確認
     */
    private async checkVideoPage(channelId: string): Promise<{ hasAds: boolean }> {
        try {
            // まずチャンネルの動画一覧から最新の動画を取得
            const videosUrl = `https://www.youtube.com/channel/${channelId}/videos`;
            const videosResponse = await fetch(videosUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ja,en;q=0.9',
                },
            });

            if (!videosResponse.ok) {
                return { hasAds: false };
            }

            const videosHtml = await videosResponse.text();

            // 動画IDを抽出
            const videoIdMatch = videosHtml.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
            if (!videoIdMatch) {
                return { hasAds: false };
            }

            const videoId = videoIdMatch[1];

            // 動画ページをチェック
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const videoResponse = await fetch(videoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ja,en;q=0.9',
                },
            });

            if (!videoResponse.ok) {
                return { hasAds: false };
            }

            const videoHtml = await videoResponse.text();

            // 広告関連のトークンを検索（元の検出パターン）
            const hasAds =
                videoHtml.includes('"yt_ad"') ||
                videoHtml.includes('"adPlacements"') ||
                videoHtml.includes('"playerAds"') ||
                videoHtml.includes('ad_preroll') ||
                videoHtml.includes('"adSlots"');

            console.log(`[Ad Check] Channel ${channelId} Video ${videoId}: ${hasAds}`);
            return { hasAds };
        } catch (error) {
            console.error(`[Ad Check Error] Channel ${channelId}:`, error);
            return { hasAds: false };
        }
    }

    /**
     * HTMLを解析してチャンネル情報を抽出（将来の拡張用）
     */
    parseChannelPage(html: string): {
        subscriberCount?: string;
        videoCount?: string;
    } {
        const $ = cheerio.load(html);

        // 登録者数を抽出（将来の機能拡張用）
        const subscriberText = $('[id="subscriber-count"]').text();

        return {
            subscriberCount: subscriberText || undefined,
        };
    }
}

/**
 * シングルトンインスタンス
 */
let checkerInstance: MonetizationChecker | null = null;

export function getMonetizationChecker(): MonetizationChecker {
    if (!checkerInstance) {
        checkerInstance = new MonetizationChecker();
    }
    return checkerInstance;
}
