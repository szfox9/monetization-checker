/**
 * 数値をフォーマット（1,234,567 → 123万）
 */
export function formatNumber(num: number): string {
    if (num >= 100000000) {
        return `${(num / 100000000).toFixed(1)}億`;
    }
    if (num >= 10000) {
        return `${(num / 10000).toFixed(1)}万`;
    }
    if (num >= 1000) {
        return num.toLocaleString();
    }
    return num.toString();
}

/**
 * 日付をフォーマット
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * 相対日時を取得（○日前、○時間前）
 */
export function getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            return `${diffMinutes}分前`;
        }
        return `${diffHours}時間前`;
    }
    if (diffDays < 7) {
        return `${diffDays}日前`;
    }
    if (diffDays < 30) {
        return `${Math.floor(diffDays / 7)}週間前`;
    }
    if (diffDays < 365) {
        return `${Math.floor(diffDays / 30)}ヶ月前`;
    }
    return `${Math.floor(diffDays / 365)}年前`;
}

/**
 * YouTubeチャンネルURLを正規化
 */
export function normalizeChannelUrl(url: string): string {
    // URLからクエリパラメータを除去
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
}

/**
 * 文字列を安全にトリム
 */
export function safeTrim(str: string | null | undefined): string {
    return str?.trim() || '';
}

/**
 * 環境変数から許可メールリストを取得
 */
export function getAllowedEmails(): string[] {
    const emails = process.env.ALLOWED_EMAILS || '';
    return emails.split(',').map((email) => email.trim()).filter(Boolean);
}

/**
 * メールアドレスが許可されているか確認
 */
export function isEmailAllowed(email: string): boolean {
    const allowedEmails = getAllowedEmails();
    // 許可リストが空の場合は全員許可
    if (allowedEmails.length === 0) return true;
    return allowedEmails.includes(email.toLowerCase());
}

/**
 * エラーメッセージを抽出
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error occurred';
}
