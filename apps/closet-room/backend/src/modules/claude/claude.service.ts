import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Anthropic from '@anthropic-ai/sdk';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';

export interface RecentMessage {
  nickname: string | null;
  senderType: 'user' | 'claude' | 'system';
  content: string;
}

const PERSONA_SYSTEM = `너는 픽셀 방 'Closet Room'에 항상 같이 있는 패션 친구야.
규칙:
- 반말, 짧고 가볍게 (1~3문장)
- 강요 금지: "꼭 사", "안 사면 후회" 같은 말 안 함
- 외모/체형 평가 금지: 사람 신체에 대한 코멘트 안 함
- 차별 금지: 성별/체형/나이에 따라 추천 가르지 않음
- 모르면 솔직히 모른다고 말함. 가격·재고는 못 봐
- 사용자끼리 의견이 다르면 양쪽 다 인정
- 한국어로 답함`;

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
   */
  async replyToMention(
    askerNickname: string,
    question: string,
    recent: RecentMessage[],
  ): Promise<string> {
    if (!this.client) {
      throw new Error('ClaudeService is not configured');
    }

    const history = recent
      .filter((m) => m.senderType !== 'system')
      .slice(-20)
      .map((m) => `${m.nickname ?? 'Claude'}: ${m.content}`)
      .join('\n');

    const userBlock = history
      ? `[최근 방 대화]\n${history}\n\n[${askerNickname}님의 질문]\n${question}`
      : `[${askerNickname}님의 질문]\n${question}`;

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
      messages: [{ role: 'user', content: userBlock }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || '음… 잠깐 생각이 안 나네. 다시 한 번 말해줄래?';
  }
}
