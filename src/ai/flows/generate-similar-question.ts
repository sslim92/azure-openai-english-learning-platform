
'use server';
/**
 * @fileOverview Generates a new question similar to a given one.
 *
 * - generateSimilarQuestion - A function that handles the question generation process.
 * - GenerateSimilarQuestionInput - The input type for the generateSimilarQuestion function.
 * - GenerateSimilarQuestionOutput - The return type for the generateSimilarQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuestionSchema = z.object({
    id: z.string().describe("A unique ID for the question. It should start with 'ai-generated-'. Use a timestamp to ensure uniqueness."),
    subject: z.string().describe("The subject of the question, which must be 'English'."),
    topic: z.string().describe("The specific topic of the question, same as the original question."),
    questionText: z.string().describe("The full text of the newly generated question. It should contain a question in Korean and a passage in English. For example: '다음 글을 읽고 물음에 답하시오. \\n\\n [English Passage]'"),
    options: z.array(z.object({
        id: z.string().describe("A unique identifier for the option (e.g., 'a', 'b', 'c', 'd', 'e')."),
        text: z.string().describe("The text of the option, which must be in English."),
    })).describe("An array of 4 or 5 possible answers for the new question."),
    correctOptionId: z.string().describe("The ID of the correct option for the new question (e.g., 'a', 'b', 'c', 'd', 'e')."),
    explanation: z.string().describe("A detailed explanation in Korean of why the correct answer for the new question is right and others are wrong."),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe("The difficulty level of the new question, which should be similar to the original question."),
    listeningScript: z.string().optional().describe("If the original question was a listening one, generate a new script."),
    generationReason: z.string().optional().describe("In Korean, explain concisely why this specific question was generated as a similar problem. For example, '이전 문제를 완벽히 이해했는지 확인하기 위해, 같은 유형의 새로운 문제를 만들었습니다.'"),
});

export type GenerateSimilarQuestionOutput = z.infer<typeof QuestionSchema>;

const OriginalQuestionContextSchema = z.object({
    topic: z.string(),
    difficulty: z.string(),
    questionText: z.string(),
    correctOptionId: z.string(),
    explanation: z.string(),
});

export type GenerateSimilarQuestionInput = z.infer<typeof OriginalQuestionContextSchema>;

export async function generateSimilarQuestion(input: GenerateSimilarQuestionInput): Promise<GenerateSimilarQuestionOutput> {
  return generateSimilarQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSimilarQuestionPrompt',
  input: {schema: OriginalQuestionContextSchema},
  output: {schema: QuestionSchema},
  prompt: `You are an expert English question creator for the Korean CSAT (Suneung).
A student has answered a question correctly and wants to try a similar one.
Your task is to create a new, original multiple-choice question that is similar to the provided example question but completely distinct.

The new question must:
- Be on the same topic: '{{topic}}'
- Have a similar difficulty level: '{{difficulty}}'
- **The main question text (e.g., '다음 글의 주제로 가장 적절한 것은?') must be in KOREAN.**
- The passage (if any) and the options must be in ENGLISH and must be completely new.
- The subject must be 'English'.
- **The explanation must be in Korean.**
- If it's a listening question, create a new, simple script in English.
- For the 'generationReason' field, provide a concise, one-sentence explanation in Korean, like: "이전 문제를 완벽히 이해했는지 확인하기 위해, 같은 유형의 새로운 문제를 만들었습니다."
- Create a detailed, logical explanation in **Korean** for why the correct answer is right.

Here is the context of the original question. Do NOT copy it. Use it as a reference for style and complexity.
---
[Original Question Context]
Topic: {{{topic}}}
Difficulty: {{{difficulty}}}
Question: {{{questionText}}}
Correct Answer Explanation: {{{explanation}}}
---

Now, based on this context, generate a brand new, unique, and high-quality question with the same topic and difficulty.
The ID should be unique, starting with 'ai-generated-' followed by a timestamp.
`,
});

const generateSimilarQuestionFlow = ai.defineFlow(
  {
    name: 'generateSimilarQuestionFlow',
    inputSchema: OriginalQuestionContextSchema,
    outputSchema: QuestionSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate a similar question.');
    }
    // Ensure the ID is unique and correct
    output.id = `ai-generated-${Date.now()}`;
    
    return output;
  }
);
