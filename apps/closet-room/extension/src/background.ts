/**
 * Background service worker — content script로부터 페이지 메타를 받아
 * Closet Room backend로 forward.
 */
import { BACKEND_URL, STORAGE_KEYS, isSensitivePath, type MessageFromContent } from './common';

interface ExternalMessage {
  type: 'set-browse-session' | 'clear-browse-session';
  browseSessionId?: string;
}

// 1) Webapp → Extension: 검색 시작/종료 트리거
chrome.runtime.onMessageExternal.addListener((message: ExternalMessage, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'set-browse-session' && message.browseSessionId) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.browseSessionId]: message.browseSessionId,
      });
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'clear-browse-session') {
      await chrome.storage.local.remove(STORAGE_KEYS.browseSessionId);
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false, reason: 'unknown' });
  })().catch((err) => sendResponse({ ok: false, reason: String(err) }));
  return true; // async response
});

// 2) Content script → Background: 페이지 메타
chrome.runtime.onMessage.addListener((message: MessageFromContent, _sender, sendResponse) => {
  (async () => {
    if (message.type !== 'page-meta') return;
    if (isSensitivePath(message.meta.url)) {
      sendResponse({ ok: false, reason: 'sensitive' });
      return;
    }
    const { [STORAGE_KEYS.token]: token, [STORAGE_KEYS.browseSessionId]: sessionId } =
      await chrome.storage.local.get([STORAGE_KEYS.token, STORAGE_KEYS.browseSessionId]);
    if (!token) {
      sendResponse({ ok: false, reason: 'not-paired' });
      return;
    }
    if (!sessionId) {
      sendResponse({ ok: false, reason: 'no-active-session' });
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/browse-sessions/${sessionId}/page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(message.meta),
      });
      if (res.status === 401) {
        // 토큰 만료 → 페어 무효화
        await chrome.storage.local.remove(STORAGE_KEYS.token);
        sendResponse({ ok: false, reason: 'token-expired' });
        return;
      }
      sendResponse({ ok: res.ok, status: res.status });
    } catch (err) {
      sendResponse({ ok: false, reason: String(err) });
    }
  })().catch((err) => sendResponse({ ok: false, reason: String(err) }));
  return true;
});
