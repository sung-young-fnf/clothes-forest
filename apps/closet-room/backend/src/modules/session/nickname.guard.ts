/**
 * 닉네임 비속어/금칙어 필터 (V1 단순 사전 기반).
 * - 사전은 한국어 + 영어 일부. 자모분리/유사문자 회피는 미지원 (V2 폴리싱).
 * - 새 단어 추가 시 BLOCKED에 lowercase로 추가.
 */
const BLOCKED = [
  '시발',
  '씨발',
  '병신',
  '븅신',
  '존나',
  '좆',
  '개새끼',
  '새끼',
  '미친',
  '닥쳐',
  '꺼져',
  'fuck',
  'shit',
  'asshole',
  'admin',
  'system',
  'claude', // Claude 사칭 방지
];

export function isBlockedNickname(nickname: string): boolean {
  const normalized = nickname.toLowerCase().replace(/\s+/g, '');
  return BLOCKED.some((bad) => normalized.includes(bad.toLowerCase()));
}
