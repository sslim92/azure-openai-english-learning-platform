
'use server';
/**
 * @fileOverview Extracts listening scripts from a PDF and maps them to existing questions.
 *
 * - matchScriptsToQuestions - A function that handles the script matching process.
 * - MatchScriptsInput - The input type for the matchScriptsToQuestions function.
 * - MatchScriptsOutput - The return type for the matchScriptsToQuestions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getQuestions, type Question } from '@/lib/data';

const ScriptMappingSchema = z.object({
  questionId: z.string().describe("The ID of the corresponding question (e.g., 'english-2024-6-1')."),
  script: z.string().describe("The full text of the listening script for that question."),
});

const MatchScriptsInputSchema = z.object({
  pdfDataUri: z.string().describe(
    "A PDF file of an exam's listening scripts, as a data URI."
  ),
  year: z.number().describe("The year of the exam to match against."),
  month: z.number().describe("The month of the exam to match against."),
});
export type MatchScriptsInput = z.infer<typeof MatchScriptsInputSchema>;

const MatchScriptsOutputSchema = z.object({
  scripts: z.array(ScriptMappingSchema).describe("An array of scripts mapped to their question IDs."),
});
export type MatchScriptsOutput = z.infer<typeof MatchScriptsOutputSchema>;

export async function matchScriptsToQuestions(
  input: MatchScriptsInput
): Promise<MatchScriptsOutput> {
  return matchScriptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'matchScriptsPrompt',
  input: { schema: z.object({
      pdfDataUri: z.string(),
      questionsContext: z.string(),
  }) },
  output: { schema: MatchScriptsOutputSchema },
  prompt: `You are an expert in analyzing educational materials for the Korean CSAT (Suneung) exam.
Your task is to extract all listening scripts from the provided PDF and map them to the corresponding listening questions.

The scripts in the PDF are ordered sequentially (1, 2, 3...). You must match them to the listening questions provided in the context, which are also sorted by their question number.

- For each script, find the matching question from the context.
- The question ID must be one of the IDs from the provided context.
- Extract the full script text.

Context of Listening Questions to Match Against:
---
{{{questionsContext}}}
---

Analyze the following PDF document containing the scripts:
{{media url=pdfDataUri}}
`,
});

const matchScriptsFlow = ai.defineFlow(
  {
    name: 'matchScriptsFlow',
    inputSchema: MatchScriptsInputSchema,
    outputSchema: MatchScriptsOutputSchema,
  },
  async (input) => {
    // Fetch only the listening questions for the specified year and month
    const allQuestions = await getQuestions();
    const listeningQuestions = allQuestions
        .filter(q => q.year === input.year && q.month === input.month && q.topic === '듣기')
        .sort((a,b) => {
            // A simple sort by question number extracted from the ID
            const numA = parseInt(a.id.split('-').pop() || '0');
            const numB = parseInt(b.id.split('-').pop() || '0');
            return numA - numB;
        });

    if (listeningQuestions.length === 0) {
        throw new Error(`No listening questions found for ${input.year}년 ${input.month}월.`);
    }

    // Create a simplified context for the prompt
    const questionsContext = listeningQuestions.map(q => 
        `ID: ${q.id}, Question Text: "${q.questionText.substring(0, 100)}..."`
    ).join('\n');

    const { output } = await prompt({ 
        pdfDataUri: input.pdfDataUri,
        questionsContext,
    });

    if (!output) {
      throw new Error('Failed to extract and match scripts from the PDF.');
    }
    return output;
  }
);
