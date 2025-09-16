
"use server";

import { analyzeUserWeaknesses } from '@/ai/flows/analyze-user-weaknesses';
import { getQuestions, type Question, addQuestions, addUserMistake, type UserMistake, getAvailableMonths, getQuestionById as getQuestionByIdFromDb, updateListeningScript } from '@/lib/data';
import { extractQuestionsFromPdf, type ExtractQuestionsOutput } from '@/ai/flows/extract-questions-from-pdf';
import { matchScriptsToQuestions } from '@/ai/flows/match-scripts-to-questions';
import { generateAudioFromText } from '@/ai/flows/generate-audio-from-text';
import { conversationalTutor } from '@/ai/flows/conversational-tutor';
import { analyzeMistakeAndGenerateQuestion, type AnalyzeMistakeAndGenerateQuestionInput } from '@/ai/flows/analyze-mistake-and-generate-question';
import { generateSimilarQuestion, type GenerateSimilarQuestionInput } from '@/ai/flows/generate-similar-question';
import type { ConversationalTutorInput } from '@/ai/flows/conversational-tutor';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const GenerateAudioOutputSchema = z.object({
  audioDataUri: z.string(),
});
type GenerateAudioOutput = z.infer<typeof GenerateAudioOutputSchema>;

function transformExtractedQuestion(extracted: any): { question: Omit<Question, 'options'>, options: { questionId: string, id: string, text: string }[] } {
    // The AI might return a questionText that contains both the main question and the passage. We need to separate them.
    const [questionText, passage] = extracted.questionText.split('\\n\\n');

    const questionData = {
        id: extracted.id,
        year: extracted.year,
        month: extracted.month,
        intent: extracted.topic, // Mapping 'topic' from AI to 'intent' in DB
        topic: 'General', // Defaulting Topic, can be refined
        questionText: questionText,
        passage: passage || '', // Handle cases with no passage
        correctOptionId: extracted.correctOptionId,
        explanation: extracted.explanation,
        difficulty: extracted.difficulty,
        listeningScript: extracted.listeningScript,
        generationReason: extracted.generationReason,
    };

    const optionsData = extracted.options.map((opt: {id: string, text: string}) => ({
        questionId: extracted.id,
        id: opt.id,
        text: opt.text,
    }));

    return { question: questionData, options: optionsData };
}

export async function uploadPdfAndExtractQuestions(pdfDataUri: string, fileName: string) {
    try {
        const result: ExtractQuestionsOutput = await extractQuestionsFromPdf({ pdfDataUri });
        
        if (result.questions && result.questions.length > 0) {
            const allQuestionsData: Omit<Question, 'options'>[] = [];
            const allOptionsData: { questionId: string, id: string, text: string }[] = [];

            result.questions.forEach(q => {
                const { question, options } = transformExtractedQuestion(q);
                allQuestionsData.push(question);
                allOptionsData.push(...options);
            });
            
            await addQuestions(allQuestionsData, allOptionsData);
            revalidatePath('/questions');
            return { success: true, questionCount: result.questions.length };
        }
        
        return { success: true, questionCount: 0 };
    } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred during PDF processing.' };
    }
}


export async function uploadScriptsAndMatchToQuestions(pdfDataUri: string, year: number, month: number, fileName: string) {
    try {
        const result = await matchScriptsToQuestions({ pdfDataUri, year, month });
        if (result.scripts && result.scripts.length > 0) {
            // In a real scenario, you might want to do this in a single transaction
            for (const script of result.scripts) {
                await updateListeningScript(script.questionId, script.script);
            }
            revalidatePath('/questions');
            return { success: true, matchCount: result.scripts.length };
        }
        return { success: true, matchCount: 0 };
    } catch (error) {
        console.error(`Error matching scripts from ${fileName}:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred during script matching.' };
    }
}

export async function getTutorResponse(questionContext: string, weaknessAnalysis: string | null, chatHistory: ConversationalTutorInput['chatHistory']) {
    try {
        const result = await conversationalTutor({ questionContext, weaknessAnalysis: weaknessAnalysis ?? undefined, chatHistory });
        return { success: true, response: result.response };
    } catch (error) {
        console.error('Tutor response failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred during tutor conversation.' };
    }
}

export async function textToSpeech(text: string): Promise<{ success: boolean; data?: GenerateAudioOutput; error?: string }> {
    try {
        const result = await generateAudioFromText(text);
        return { success: true, data: result };
    } catch (error) {
        console.error('Text-to-speech failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred during text-to-speech conversion.' };
    }
}

export async function processUserMistake(input: {
    userId: string;
    questionId: string;
    questionContext: string;
    selectedOptionId: string;
    selectedOptionText: string;
    userReason: string;
}) {
    try {
        const mistakeRecord: UserMistake = {
            userId: input.userId,
            questionId: input.questionId,
            selectedOptionKey: input.selectedOptionId,
            reason: input.userReason,
        };
        await addUserMistake(mistakeRecord);
        revalidatePath('/progress');

        const aiInput: AnalyzeMistakeAndGenerateQuestionInput = {
            questionContext: input.questionContext,
            userAnswerText: input.selectedOptionText,
            userReason: input.userReason,
        };
        const aiResult = await analyzeMistakeAndGenerateQuestion(aiInput);

        const { question: newQuestionData, options: newOptionsData } = transformExtractedQuestion(aiResult.generatedQuestion);
        
        await addQuestions([newQuestionData], newOptionsData);

        revalidatePath('/questions');
        revalidatePath('/random-quiz');

        return {
            success: true,
            analysis: aiResult.weaknessAnalysis,
            newQuestion: { ...newQuestionData, options: newOptionsData.map(o => ({ id: o.id, text: o.text })) } as Question,
        };

    } catch (error) {
        console.error("Error processing user mistake:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}


export async function createSimilarQuestion(originalQuestion: Question) {
     try {
        const aiInput: GenerateSimilarQuestionInput = {
            topic: originalQuestion.topic,
            difficulty: originalQuestion.difficulty,
            questionText: `${originalQuestion.questionText}\n\n${originalQuestion.passage}`,
            correctOptionId: originalQuestion.correctOptionId,
            explanation: originalQuestion.explanation,
        };

        const aiGeneratedQuestion = await generateSimilarQuestion(aiInput);

        const { question: newQuestionData, options: newOptionsData } = transformExtractedQuestion(aiGeneratedQuestion);

        await addQuestions([newQuestionData], newOptionsData);
        revalidatePath('/questions');
        revalidatePath('/random-quiz');

        return {
            success: true,
            newQuestion: { ...newQuestionData, options: newOptionsData.map(o => ({ id: o.id, text: o.text })) } as Question,
        };
    } catch (error) {
        console.error("Error generating similar question:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}


// --- Server Actions for data fetching ---

export async function fetchAllQuestions(): Promise<Question[]> {
    return getQuestions();
}

export async function fetchQuestionById(id: string): Promise<Question | null> {
    return getQuestionByIdFromDb(id);
}


export async function getAvailableYears(): Promise<number[]> {
    const questions = await getQuestions();
    const years = new Set(questions.map(q => q.year).filter((y): y is number => y !== undefined));
    return Array.from(years).sort((a, b) => b - a);
}

export async function getAvailableMonthsForYear(year: number) {
    return getAvailableMonths(year);
}
