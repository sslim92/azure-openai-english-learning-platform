
'use server';
/**
 * @fileOverview Analyzes a user's mistake and generates a new, similar question to address the weakness.
 *
 * - analyzeMistakeAndGenerateQuestion - A function that handles the analysis and generation process.
 * - AnalyzeMistakeAndGenerateQuestionInput - The input type for the function.
 * - AnalyzeMistakeAndGenerateQuestionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const AnalyzeMistakeAndGenerateQuestionInputSchema = z.object({
  questionContext: z.string().describe("The context of the original question the user got wrong, including text, options, and correct answer."),
  userAnswerText: z.string().describe("The text of the incorrect option the user chose."),
  userReason: z.string().describe("The user's own explanation for why they chose the incorrect answer."),
});
export type AnalyzeMistakeAndGenerateQuestionInput = z.infer<typeof AnalyzeMistakeAndGenerateQuestionInputSchema>;


// Output Schema for the new question
const NewQuestionSchema = z.object({
    id: z.string().describe("A unique ID for the question. It should start with 'ai-generated-'. Use a timestamp to ensure uniqueness."),
    subject: z.string().describe("The subject of the question. This must be 'English'."),
    topic: z.string().describe("The specific topic of the question, same as the original question's topic."),
    questionText: z.string().describe("The full text of the newly generated question. It should contain a question in Korean and a passage in English. For example: '다음 글을 읽고 물음에 답하시오. \\n\\n [English Passage]'"),
    options: z.array(z.object({
        id: z.string().describe("A unique identifier for the option (e.g., 'a', 'b', 'c', 'd', 'e')."),
        text: z.string().describe("The text of the option, which must be in English."),
    })).describe("An array of 4 or 5 possible answers for the new question."),
    correctOptionId: z.string().describe("The ID of the correct option for the new question (e.g., 'a', 'b', 'c', 'd', 'e')."),
    explanation: z.string().describe("A detailed explanation in **Korean** of why the correct answer for the new question is right, often referencing the user's original mistake."),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe("The difficulty level of the new question, which should be similar to the original question."),
    generationReason: z.string().optional().describe("In Korean, explain concisely why this specific question was generated to address the user's identified weakness. For example, 'This question was created to address your confusion about the word 'ephemeral' by using it in a new context.'"),
});

// Output Schema for the entire flow
const AnalyzeMistakeAndGenerateQuestionOutputSchema = z.object({
  weaknessAnalysis: z.string().describe("A detailed analysis in Korean of the user's weakness based on their reasoning. This will be shown to the user."),
  generatedQuestion: NewQuestionSchema.describe("The newly generated question designed to address the user's identified weakness."),
});
export type AnalyzeMistakeAndGenerateQuestionOutput = z.infer<typeof AnalyzeMistakeAndGenerateQuestionOutputSchema>;


export async function analyzeMistakeAndGenerateQuestion(input: AnalyzeMistakeAndGenerateQuestionInput): Promise<AnalyzeMistakeAndGenerateQuestionOutput> {
  return analyzeMistakeAndGenerateQuestionFlow(input);
}


const prompt = ai.definePrompt({
  name: 'analyzeAndGeneratePrompt',
  input: {schema: AnalyzeMistakeAndGenerateQuestionInputSchema},
  output: {schema: AnalyzeMistakeAndGenerateQuestionOutputSchema},
  prompt: `You are an expert English tutor and question creator for the Korean CSAT (Suneung).
A student has answered a question incorrectly. Your task is to perform three steps.

1.  **Analyze the Weakness (in Korean)**: First, analyze the student's reasoning for their mistake. Provide a concise, empathetic, and insightful analysis of their core misunderstanding. This analysis will be shown directly to the student.

2.  **Generate a New Question**: Based on your analysis, create a completely new, original multiple-choice question that directly targets the student's identified weakness. The new question must:
    - Be on the same topic and similar difficulty as the original.
    - **The main question text (e.g., '다음 글의 주제로 가장 적절한 것은?') must be in KOREAN.**
    - The passage (if any) and the options must be in ENGLISH and must be completely new.
    - Include a detailed **explanation in Korean** that not only explains the correct answer for the new question but also subtly references why a student might make the original mistake.
    - Create a unique ID starting with 'ai-generated-'.

3.  **Explain the Generation Reason (in Korean)**: For the 'generationReason' field, provide a concise, one-sentence explanation in Korean for **why this new question helps address the user's weakness**. For example: "‘ephemeral’ 단어의 의미를 헷갈리셨던 점을 보완하기 위해, 해당 단어가 포함된 새로운 지문으로 문제를 만들었습니다." or "복잡한 문장 구조 파악에 어려움을 겪으신 것을 보완하기 위해, 비슷한 문법 구조를 가진 지문으로 문제를 구성했습니다."

**Original Question Context:**
---
{{{questionContext}}}
---

**Student's Mistake:**
---
- **They Chose:** {{{userAnswerText}}}
- **Their Reason:** {{{userReason}}}
---

Now, perform the analysis and generate the new question and its generation reason based on this information. All textual output for the user (analysis, explanation, generationReason) must be in Korean.
`,
});


const analyzeMistakeAndGenerateQuestionFlow = ai.defineFlow(
  {
    name: 'analyzeMistakeAndGenerateQuestionFlow',
    inputSchema: AnalyzeMistakeAndGenerateQuestionInputSchema,
    outputSchema: AnalyzeMistakeAndGenerateQuestionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Failed to analyze mistake and generate a new question.');
    }
    
    // Finalize the generated question object
    output.generatedQuestion.id = `ai-generated-${Date.now()}`;
    
    return output;
  }
);
