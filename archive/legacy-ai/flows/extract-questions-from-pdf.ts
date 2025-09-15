'use server';
/**
 * @fileOverview Extracts questions from a PDF file.
 *
 * - extractQuestionsFromPdf - A function that extracts questions from a PDF file.
 * - ExtractQuestionsInput - The input type for the extractQuestionsFromPdf function.
 * - ExtractQuestionsOutput - The return type for the extractQuestionsFromPdf function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuestionSchema = z.object({
    id: z.string().describe("A unique ID for the question (e.g., 'english-2024-6-2'). It should be unique among all questions, following the format 'english-YEAR-MONTH-QUESTION_NUMBER'."),
    year: z.number().optional().describe("The year the exam was administered."),
    month: z.number().optional().describe("The month the exam was administered (e.g., 6 for June, 9 for September, 11 for CSAT)."),
    subject: z.string().describe("The subject of the question. This must be 'English'."),
    topic: z.string().describe("The specific topic of the question (e.g., 'Vocabulary', 'Grammar', 'Reading Comprehension', 'Listening'). If it is a listening question, you must set this to '듣기'."),
    questionText: z.string().describe("The full text of the question, including any passage if it's a reading comprehension problem."),
    options: z.array(z.object({
        id: z.string().describe("A unique identifier for the option (e.g., 'a', 'b', 'c', 'd', 'e')."),
        text: z.string().describe("The text of the option."),
    })).describe("An array of possible answers."),
    correctOptionId: z.string().describe("The ID of the correct option (e.g., 'a', 'b', 'c', 'd', 'e')."),
    explanation: z.string().describe("A detailed explanation in **Korean** of why the correct answer is right and others are wrong."),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe("The difficulty level of the question, assessed from its content."),
    listeningScript: z.string().optional().describe("If the question is a listening comprehension problem, this field should contain the full text script of the audio."),
});

const ExtractQuestionsInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file of an exam paper, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'"
    ),
});
export type ExtractQuestionsInput = z.infer<typeof ExtractQuestionsInputSchema>;

const ExtractQuestionsOutputSchema = z.object({
  questions: z.array(QuestionSchema).describe('An array of all questions extracted from the PDF.'),
});
export type ExtractQuestionsOutput = z.infer<typeof ExtractQuestionsOutputSchema>;

export async function extractQuestionsFromPdf(
  input: ExtractQuestionsInput
): Promise<ExtractQuestionsOutput> {
  return extractQuestionsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'extractQuestionsPrompt',
    input: { schema: ExtractQuestionsInputSchema },
    output: { schema: ExtractQuestionsOutputSchema },
    prompt: `You are an expert in analyzing educational materials for the Korean CSAT (Suneung) and mock exams. 
Your task is to meticulously extract all multiple-choice questions from the provided English exam paper PDF.
The document may be in a two-column format. You must parse it carefully by following the question numbers sequentially.

For each question, you must identify and structure the following components:
- The year of the exam. You must identify this from the PDF content (e.g., '2026학년도').
- The month of the exam (e.g., '6월', '9월'). If it is the main CSAT, use 11 for the month. You must find this information in the PDF.
- A unique ID for the question, following the format 'english-YEAR-MONTH-QUESTION_NUMBER' (e.g., english-2026-6-1).
- The subject (which is always 'English').
- A relevant topic (e.g., Vocabulary, Grammar, Reading Comprehension, Idiomatic Expressions).
- **Crucially, if a question is a listening question (indicated by phrases like "대화를 듣고," "다음을 듣고," or question numbers 1 through 17), you MUST set its topic to '듣기'.**
- The full question text. If the question refers to a passage, the passage must be included in the questionText.
- If it is a listening question, extract the audio script if it is available in the provided PDF and place it in the 'listeningScript' field.
- All multiple-choice options with their own IDs and text. The options are usually labeled ①, ②, ③, ④, ⑤; you must map these to 'a', 'b', 'c', 'd', 'e' respectively.
- The ID of the correct option. Often, the correct answers and explanations are grouped at the end of the document.
- A comprehensive explanation **in Korean** for the correct answer.
- The difficulty level (Easy, Medium, Hard), which you must infer based on the question's complexity, vocabulary, and length.

Analyze the entire PDF document carefully to find all questions and their corresponding answers/explanations, which may be in a separate section.

Analyze the following PDF document:
{{media url=pdfDataUri}}
`,
});

const extractQuestionsFlow = ai.defineFlow(
    {
        name: 'extractQuestionsFlow',
        inputSchema: ExtractQuestionsInputSchema,
        outputSchema: ExtractQuestionsOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        if (!output) {
            throw new Error('Failed to extract questions from the PDF.');
        }
        return output;
    }
);
