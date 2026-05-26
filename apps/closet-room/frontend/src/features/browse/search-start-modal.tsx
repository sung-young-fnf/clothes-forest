'use client';

import { useState } from 'react';

interface SearchStartModalProps {
  nonce: string;
  onClose: () => void;
}

export default function SearchStartModal({ nonce, onClose }: SearchStartModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(nonce);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="search-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="space-y-1">
          <h2 id="search-modal-title" className="text-lg font-bold">
            쇼핑 동행 시작
          </h2>
          <p className="text-xs text-gray-500">
            Chrome 확장 프로그램과 한 번 페어링하면, 보는 페이지가 방에 자동 공유돼요.
          </p>
        </header>

        <ol className="space-y-3 text-sm text-gray-700">
          <li>
            <strong>1.</strong> 우상단 Chrome 퍼즐 아이콘 → <em>Closet Room</em> 클릭
          </li>
          <li>
            <strong>2.</strong> 아래 페어링 코드를 popup의 입력칸에 붙여넣고{' '}
            <strong>페어링</strong>
          </li>
          <li>
            <strong>3.</strong> 무신사·29CM·쿠팡·지그재그 중 한 곳을 열기
          </li>
        </ol>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-700">페어링 코드</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={nonce}
              className="flex-1 truncate rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={copy}
              className="rounded-md bg-gray-900 px-3 text-xs font-semibold text-white"
            >
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">5분 안에 페어링하세요. 만료되면 다시 시작.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
