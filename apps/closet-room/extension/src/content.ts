/**
 * Content script — 쇼핑몰 페이지에서 og 메타·제목·가격을 추출해
 * background로 전달.
 */
import type { MessageFromContent, PageMeta } from './common';

function metaContent(name: string): string | undefined {
  const el =
    document.querySelector(`meta[property="${name}"]`) ??
    document.querySelector(`meta[name="${name}"]`);
  return (el as HTMLMetaElement | null)?.content?.trim() || undefined;
}

function pickPrice(): string | undefined {
  const selectors = [
    '[itemprop="price"]',
    '[data-mds*="price"]',
    '.price',
    '.product-price',
    '.sale_price',
    '[class*="Price"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && /\d/.test(text)) return text.slice(0, 50);
  }
  return undefined;
}

function collectMeta(): PageMeta {
  const url = location.href;
  const title = metaContent('og:title') ?? document.title ?? undefined;
  const ogImageUrl = metaContent('og:image');
  const ogDescription = metaContent('og:description');
  const siteName = metaContent('og:site_name') ?? location.hostname;
  const priceText = pickPrice();
  return { url, title, ogImageUrl, ogDescription, siteName, priceText };
}

function send() {
  const msg: MessageFromContent = { type: 'page-meta', meta: collectMeta() };
  chrome.runtime.sendMessage(msg).catch(() => {
    // background가 idle일 수 있음 — 다음 변경 때 다시 보냄
  });
}

// 초기 로드
send();

// SPA 라우팅 대응 (무신사·29CM 등) — history.pushState/replaceState 감지
let lastHref = location.href;
const patch = (type: 'pushState' | 'replaceState') => {
  const orig = history[type];
  history[type] = function (...args: Parameters<typeof orig>) {
    const ret = orig.apply(this, args);
    if (location.href !== lastHref) {
      lastHref = location.href;
      // DOM 갱신 후 메타 다시 수집
      setTimeout(send, 400);
    }
    return ret;
  };
};
patch('pushState');
patch('replaceState');
window.addEventListener('popstate', () => setTimeout(send, 400));
