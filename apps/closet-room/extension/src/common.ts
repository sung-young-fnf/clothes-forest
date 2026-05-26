/**
 * Extension 전반에서 쓰이는 공용 상수/타입.
 */
export const STORAGE_KEYS = {
  token: 'closet_device_token',
  browseSessionId: 'closet_browse_session_id',
  nickname: 'closet_nickname',
} as const;

export const BACKEND_URL = 'http://localhost:8000';

export interface PageMeta {
  url: string;
  title?: string;
  ogImageUrl?: string;
  ogDescription?: string;
  siteName?: string;
  priceText?: string;
}

export interface MessageFromContent {
  type: 'page-meta';
  meta: PageMeta;
}

export function isSensitivePath(url: string): boolean {
  return /\b(login|signin|sign-in|pay|payment|checkout|order|cart|password)\b/i.test(url);
}
