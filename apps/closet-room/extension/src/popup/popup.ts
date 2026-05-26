import { BACKEND_URL, STORAGE_KEYS } from '../common';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

async function refresh() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.token,
    STORAGE_KEYS.nickname,
    STORAGE_KEYS.browseSessionId,
  ]);
  const paired = Boolean(data[STORAGE_KEYS.token]);
  $('paired-state').style.display = paired ? 'block' : 'none';
  $('unpaired-state').style.display = paired ? 'none' : 'block';
  if (paired) {
    $('paired-nickname').textContent = (data[STORAGE_KEYS.nickname] as string) ?? '익명';
    $('session-hint').textContent = data[STORAGE_KEYS.browseSessionId]
      ? '쇼핑 세션 활성 — 페이지가 자동 공유돼요'
      : '방에서 "검색 시작"을 누르면 자동으로 활성화돼요.';
  }
}

function setStatus(text: string, kind: 'ok' | 'err') {
  const el = $('status');
  el.style.display = 'block';
  el.className = `status ${kind}`;
  el.textContent = text;
}

async function exchange() {
  const nonce = ($('nonce') as HTMLInputElement).value.trim();
  if (!nonce) {
    setStatus('코드를 입력해주세요', 'err');
    return;
  }
  const btn = $('exchange') as HTMLButtonElement;
  btn.disabled = true;
  try {
    const res = await fetch(`${BACKEND_URL}/api/pairings/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      token: string;
      browseSessionId: string;
      session: { nickname: string };
    };
    await chrome.storage.local.set({
      [STORAGE_KEYS.token]: data.token,
      [STORAGE_KEYS.nickname]: data.session.nickname,
      [STORAGE_KEYS.browseSessionId]: data.browseSessionId,
    });
    setStatus('페어링 완료! 무신사·29CM 등을 열어보세요', 'ok');
    await refresh();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '페어링 실패';
    // 흔한 케이스: backend(8000) 미기동 또는 manifest host_permissions 누락
    const hint =
      msg === 'Failed to fetch'
        ? ' — backend(http://localhost:8000)가 떠있는지 확인하세요'
        : '';
    setStatus(msg + hint, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function unpair() {
  await chrome.storage.local.remove([STORAGE_KEYS.token, STORAGE_KEYS.nickname, STORAGE_KEYS.browseSessionId]);
  await refresh();
  setStatus('페어 해제됨', 'ok');
}

document.addEventListener('DOMContentLoaded', () => {
  void refresh();
  $('exchange').addEventListener('click', () => void exchange());
  $('unpair').addEventListener('click', () => void unpair());
});
