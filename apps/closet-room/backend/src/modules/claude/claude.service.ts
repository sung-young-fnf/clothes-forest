import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Anthropic from '@anthropic-ai/sdk';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';

export interface RecentMessage {
  nickname: string | null;
  senderType: 'user' | 'claude' | 'system';
  content: string;
}

/** 호스트가 현재 보고 있는 쇼핑몰 페이지 정보 (browse_sessions의 마지막 page_event) */
export interface PageContext {
  url: string;
  title: string | null;
  ogImageUrl: string | null;
  ogDescription: string | null;
  siteName: string | null;
  priceText: string | null;
}

const PERSONA_SYSTEM = `너는 픽셀 방 'Closet Room'에 항상 같이 있는 패션 친구야.
규칙:
- 반말, 짧고 가볍게 (1~3문장)
- 강요 금지: "꼭 사", "안 사면 후회" 같은 말 안 함
- 외모/체형 평가 금지: 사람 신체에 대한 코멘트 안 함
- 차별 금지: 성별/체형/나이에 따라 추천 가르지 않음
- 페이지 이미지가 같이 오면 그 옷의 색감/실루엣/스타일 위주로 코멘트
- 가격·설명이 있으면 그대로 참고. 없는 정보(재고 등)는 모른다고 솔직히 말함
- 사용자끼리 의견이 다르면 양쪽 다 인정
- 한국어로 답함`;

// Anthropic vision 허용 포맷 + 안전 한도
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const IMAGE_FETCH_TIMEOUT_MS = 5000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type UserContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam;

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: AnthropicBedrock | null;
  private readonly modelId: string;

  constructor(config: ConfigService) {
    const token = config.get<string>('AWS_BEARER_TOKEN_BEDROCK');
    this.modelId =
      config.get<string>('SONNET_MODEL_ID') ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
    if (!token) {
      this.logger.warn('AWS_BEARER_TOKEN_BEDROCK 미설정 — ClaudeService 비활성');
      this.client = null;
      return;
    }
    const awsRegion = config.get<string>('AWS_REGION') ?? 'us-west-2';
    this.client = new AnthropicBedrock({ awsRegion });
    this.logger.log(`ClaudeService 활성 (region=${awsRegion}, model=${this.modelId})`);
  }

  /** 토큰 미설정 시 false. RoomGateway에서 안내 메시지 분기용. */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * @claude 멘션에 대한 응답 생성.
   * @param askerNickname  멘션한 사용자 닉네임
   * @param question       @claude 뒤의 본문 (이미 trim된 상태)
   * @param recent         최근 채팅 (오래된→최신, system 제외)
   * @param pageContext    호스트가 지금 보는 쇼핑 페이지 메타. 있으면 og 이미지를 vision으로 같이 전달
   */
  async replyToMention(
    askerNickname: string,
    question: string,
    recent: RecentMessage[],
    pageContext?: PageContext | null,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('ClaudeService is not configured');
    }

    const history = recent
      .filter((m) => m.senderType !== 'system')
      .slice(-20)
      .map((m) => `${m.nickname ?? 'Claude'}: ${m.content}`)
      .join('\n');

    const questionBlock = history
      ? `[최근 방 대화]\n${history}\n\n[${askerNickname}님의 질문]\n${question}`
      : `[${askerNickname}님의 질문]\n${question}`;

    // 페이지 컨텍스트가 있으면 vision 이미지 + 메타 텍스트를 질문 앞에 배치
    const userContent: UserContentBlock[] = [];
    if (pageContext) {
      if (pageContext.ogImageUrl) {
        const img = await this.fetchImageAsBase64(pageContext.ogImageUrl);
        if (img) {
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType, data: img.data },
          } as Anthropic.ImageBlockParam);
        }
      }
      const meta = [
        `[지금 ${pageContext.siteName ?? '쇼핑몰'}에서 보고 있는 페이지]`,
        pageContext.title ? `제목: ${pageContext.title}` : null,
        pageContext.priceText ? `가격: ${pageContext.priceText}` : null,
        pageContext.ogDescription ? `설명: ${pageContext.ogDescription}` : null,
        `URL: ${pageContext.url}`,
      ]
        .filter((s): s is string => Boolean(s))
        .join('\n');
      userContent.push({ type: 'text', text: meta });
    }
    userContent.push({ type: 'text', text: questionBlock });

    const response = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 400,
      system: [
        {
          type: 'text',
          text: PERSONA_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ] as unknown as Anthropic.TextBlockParam[],
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || '음… 잠깐 생각이 안 나네. 다시 한 번 말해줄래?';
  }

  /** og_image_url을 받아 Anthropic vision이 받아주는 base64 포맷으로 변환. 실패하면 null */
  private async fetchImageAsBase64(
    url: string,
  ): Promise<{ mediaType: string; data: string } | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      if (!res.ok) {
        this.logger.warn(`og_image fetch ${res.status}: ${url}`);
        return null;
      }
      const contentType = (res.headers.get('content-type') ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!SUPPORTED_IMAGE_TYPES.includes(contentType)) {
        this.logger.warn(`og_image type unsupported (${contentType}): ${url}`);
        return null;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > IMAGE_MAX_BYTES) {
        this.logger.warn(`og_image size out of range (${buf.byteLength}B): ${url}`);
        return null;
      }
      return { mediaType: contentType, data: Buffer.from(buf).toString('base64') };
    } catch (err) {
      this.logger.warn(`og_image fetch 실패: ${url} (${(err as Error).message})`);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
