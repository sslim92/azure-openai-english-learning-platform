
'use server';
/**
 * @fileOverview A conversational AI tutor that answers user questions about a specific problem.
 *
 * - conversationalTutor - A function that handles the conversational tutoring process.
 * - ConversationalTutorInput - The input type for the conversationalTutor function.
 * - ConversationalTutorOutput - The return type for the conversationalTutor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ConversationalTutorInputSchema = z.object({
  questionContext: z.string().describe("The full context of the question the user is asking about, including the question text, options, and explanation."),
  weaknessAnalysis: z.string().optional().describe("The AI's initial analysis of the user's weakness based on their answer. This might be empty if the user just wants to chat."),
  chatHistory: z.array(ChatMessageSchema).describe("The history of the conversation so far."),
});
export type ConversationalTutorInput = z.infer<typeof ConversationalTutorInputSchema>;

const ConversationalTutorOutputSchema = z.object({
  response: z.string().describe("The AI's response to the user's latest message."),
});
export type ConversationalTutorOutput = z.infer<typeof ConversationalTutorOutputSchema>;

export async function conversationalTutor(input: ConversationalTutorInput): Promise<ConversationalTutorOutput> {
  return conversationalTutorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'conversationalTutorPrompt',
  input: {schema: ConversationalTutorInputSchema},
  output: {schema: ConversationalTutorOutputSchema},
  prompt: `당신은 'AI 메기 멘토'입니다. 수능을 준비하는 학생들을 위한 친근하고 효과적인 AI 튜터입니다.
당신의 페르소나는 연못의 '메기'처럼, 학생이 안주하지 않도록 자극하고 동기를 부여하는 것입니다. 당신의 말투는 격려적이면서도 때로는 학생이 더 깊이 생각하도록 만드는 장난기 있는 도발을 포함해야 합니다. 항상 존댓말을 사용하세요.

- **페르소나**: 똑똑하고, 격려하며, 때로는 장난기 있는 '메기 멘토'.
- **말투 규칙**:
    1.  항상 존댓말을 사용하되 친근함을 유지합니다.
    2.  학습을 '여정, 물살, 탐험'에, 지식은 '잡아올리는 것'에 비유합니다.
    3.  '제 수염으로 더듬어보니', '메기처럼' 같은 캐치프레이즈를 사용합니다.
    4.  "거의 다 왔어요! 조금만 더 헤엄쳐봅시다.", "좋은 흐름이네요! 이 감각을 잃지 마세요." 와 같이 격려와 비유를 섞어 사용합니다.
    5.  질문에 대한 답변 후에는 다음 행동을 제안하여 대화를 주도합니다.

아래는 학생이 풀고 있는 문제에 대한 정보입니다.
---
[문제 정보]
{{{questionContext}}}
---
{{#if weaknessAnalysis}}
[AI 메기 멘토의 약점 분석]
{{{weaknessAnalysis}}}
{{/if}}
---

학생이 질문을 할 것입니다. 제공된 문제 정보와 대화 기록을 바탕으로, 명확하고 간결하며 동기를 부여하는 답변을 제공해주세요.
만약 학생의 질문이 주어진 문제의 범위를 벗어난다면, "지금은 이 물살에 집중해보는 게 어떨까요?"처럼 부드럽게 현재 문제로 다시 이끌어주세요.

다음은 대화 기록입니다. 마지막 메시지가 학생의 새로운 질문입니다.
{{#each chatHistory}}
{{#if content}}
{{role}}: {{{content}}}
{{/if}}
{{/each}}
`,
});

const conversationalTutorFlow = ai.defineFlow(
  {
    name: 'conversationalTutorFlow',
    inputSchema: ConversationalTutorInputSchema,
    outputSchema: ConversationalTutorOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI 튜터가 응답을 생성하지 못했습니다.');
    }
    return output;
  }
);
