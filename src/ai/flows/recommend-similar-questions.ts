'use server';

/**
 * @fileOverview 이 플로우는 사용자의 약점 분석을 기반으로 유사한 문제를 추천합니다.
 *
 * - recommendSimilarQuestions - 사용자 약점에 기반하여 유사한 문제를 추천하는 함수.
 * - RecommendSimilarQuestionsInput - recommendSimilarQuestions 함수의 입력 타입.
 * - RecommendSimilarQuestionsOutput - recommendSimilarQuestions 함수의 반환 타입.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendSimilarQuestionsInputSchema = z.object({
  weaknessAnalysis: z
    .string()
    .describe('사용자 약점에 대한 상세 분석 결과.'),
  questionBankContext: z
    .string()
    .describe(
      '과목, 주제, 난이도 등을 포함한 문제 은행에 대한 문맥 정보.'
    ),
});
export type RecommendSimilarQuestionsInput = z.infer<
  typeof RecommendSimilarQuestionsInputSchema
>;

const RecommendSimilarQuestionsOutputSchema = z.object({
  similarQuestions: z
    .array(z.string())
    .describe(
      '사용자 약점을 보완하기 위해 추천된 유사 문제 목록.'
    ),
});
export type RecommendSimilarQuestionsOutput = z.infer<
  typeof RecommendSimilarQuestionsOutputSchema
>;

export async function recommendSimilarQuestions(
  input: RecommendSimilarQuestionsInput
): Promise<RecommendSimilarQuestionsOutput> {
  return recommendSimilarQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendSimilarQuestionsPrompt',
  input: {schema: RecommendSimilarQuestionsInputSchema},
  output: {schema: RecommendSimilarQuestionsOutputSchema},
  prompt: `당신은 학생에게 개인화된 학습 경로를 추천하는 AI 학습 코치입니다.
다음의 약점 분석 결과와 문제 은행 정보를 바탕으로, 학생이 약한 부분을 향상시키는 데 도움이 될 만한 문제의 **주제(topic)**나 **핵심 키워드**를 한국어로 추천해주세요.

약점 분석:
{{{weaknessAnalysis}}}

문제 은행 정보:
{{{questionBankContext}}}

추천:`,
});

const recommendSimilarQuestionsFlow = ai.defineFlow(
  {
    name: 'recommendSimilarQuestionsFlow',
    inputSchema: RecommendSimilarQuestionsInputSchema,
    outputSchema: RecommendSimilarQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
