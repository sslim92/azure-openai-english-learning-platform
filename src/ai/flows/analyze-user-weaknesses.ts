
'use server';
/**
 * @fileOverview 사용자의 연습 문제 답변을 기반으로 약점을 분석합니다.
 *
 * - analyzeUserWeaknesses - 사용자 약점 분석 프로세스를 처리하는 함수.
 * - AnalyzeUserWeaknessesInput - analyzeUserWeaknesses 함수의 입력 타입.
 * - AnalyzeUserWeaknessesOutput - analyzeUserWeaknesses 함수의 반환 타입.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUserWeaknessesInputSchema = z.object({
  testAnswers: z.string().describe('사용자가 제출한 답안 정보.'),
  questionDetails: z.string().describe('시험 문제의 상세 정보.'),
});
export type AnalyzeUserWeaknessesInput = z.infer<typeof AnalyzeUserWeaknessesInputSchema>;

const AnalyzeUserWeaknessesOutputSchema = z.object({
  weaknesses: z.string().describe('사용자의 답안에 기반한 약점 분석 결과.'),
});
export type AnalyzeUserWeaknessesOutput = z.infer<typeof AnalyzeUserWeaknessesOutputSchema>;

export async function analyzeUserWeaknesses(input: AnalyzeUserWeaknessesInput): Promise<AnalyzeUserWeaknessesOutput> {
  return analyzeUserWeaknessesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeUserWeaknessesPrompt',
  input: {schema: AnalyzeUserWeaknessesInputSchema},
  output: {schema: AnalyzeUserWeaknessesOutputSchema},
  prompt: `당신은 학생들의 학습 약점을 정확히 진단하는 입시 전문가입니다.
사용자의 답안과 문제 정보를 바탕으로, 왜 틀렸는지 또는 맞았더라도 어떤 개념이 부족한지를 한국어로 상세히 분석해주세요.

- 정답을 맞췄더라도, 헷갈릴 수 있는 다른 선택지나 관련된 추가 개념을 언급하며 분석할 수 있습니다.
- 틀린 경우에는, 어떤 개념을 오해했는지, 또는 문제의 어떤 부분을 놓쳤는지 구체적으로 지적해주세요.

문제 정보:
{{{questionDetails}}}

사용자 답안 정보:
{{{testAnswers}}}

위 정보를 바탕으로 사용자의 약점에 대한 심층 분석을 한국어로 작성해주세요.
`,
});

const analyzeUserWeaknessesFlow = ai.defineFlow(
  {
    name: 'analyzeUserWeaknessesFlow',
    inputSchema: AnalyzeUserWeaknessesInputSchema,
    outputSchema: AnalyzeUserWeaknessesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
