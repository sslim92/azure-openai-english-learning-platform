
"use server";

import { analyzeUserWeaknesses } from '@/ai/flows/analyze-user-weaknesses';
import { getQuestions, type Question, addQuestions, updateQuestionsWithScripts, addUserMistake, type UserMistake, getAvailableMonths } from '@/lib/data';
import { extractQuestionsFromPdf } from '@/ai/flows/extract-questions-from-pdf';
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


export async function uploadPdfAndExtractQuestions(pdfDataUri: string, fileName: string) {
  try {
    if (!pdfDataUri.startsWith('data:application/pdf;base64,')) {
        throw new Error('잘못된 데이터 URI입니다. Base64로 인코딩된 PDF여야 합니다.');
    }

    const result = await extractQuestionsFromPdf({ pdfDataUri });

    if (result.questions) {
      if (result.questions.length > 0) {
        await addQuestions(result.questions as Question[]);
        revalidatePath('/');
        revalidatePath('/questions');
        revalidatePath('/random-quiz');
      }
      return { success: true, questionCount: result.questions.length };
    }
    
    return { success: false, error: 'AI가 문서에서 질문을 찾을 수 없습니다. 문서 형식이 지원되지 않거나 PDF가 이미지 기반일 수 있습니다.' };

  } catch (error) {
    console.error(`${fileName} 처리 중 오류:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
     if (errorMessage.includes('Invalid PDF')) {
       return { success: false, error: '잘못되었거나 손상된 PDF 파일입니다. 파일을 확인하고 다시 시도해주세요.' };
    }
    return { success: false, error: `PDF 처리 실패. 세부 정보: ${errorMessage}` };
  }
}

export async function uploadScriptsAndMatchToQuestions(pdfDataUri: string, year: number, month: number, fileName:string) {
  try {
    if (!pdfDataUri.startsWith('data:application/pdf;base64,')) {
      throw new Error('잘못된 데이터 URI입니다. Base64로 인코딩된 PDF여야 합니다.');
    }
    const allQuestions = await getQuestions();
    const targetQuestions = allQuestions.filter(q => q.year === year && q.month === month && q.topic === '듣기');

    if (targetQuestions.length === 0) {
      return { success: false, error: `${year}년 ${month}월의 듣기 평가 문제를 찾을 수 없습니다. 먼저 해당 연도의 시험지를 업로드해주세요.` };
    }

    const result = await matchScriptsToQuestions({ pdfDataUri, year, month });
    
    if (result.scripts && result.scripts.length > 0) {
      await updateQuestionsWithScripts(result.scripts);
      revalidatePath('/');
      revalidatePath('/questions');
      revalidatePath('/random-quiz');
      return { success: true, matchCount: result.scripts.length };
    }
    
    return { success: false, error: 'AI가 대본 PDF에서 스크립트를 추출하지 못했습니다.' };
  } catch (error) {
    console.error(`${fileName} 처리 중 오류:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: `듣기 대본 처리 실패. 세부 정보: ${errorMessage}` };
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
        const mistakeRecord: Omit<UserMistake, 'id' | 'timestamp'> = {
            userId: input.userId,
            questionId: input.questionId,
            selectedOptionId: input.selectedOptionId,
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

        const newQuestion = aiResult.generatedQuestion as Question;
        await addQuestions([newQuestion]);
        revalidatePath('/questions');
        revalidatePath('/random-quiz');

        return {
            success: true,
            analysis: aiResult.weaknessAnalysis,
            newQuestion: newQuestion,
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
            questionText: originalQuestion.questionText,
            correctOptionId: originalQuestion.correctOptionId,
            explanation: originalQuestion.explanation,
        };

        const newQuestion = await generateSimilarQuestion(aiInput);

        await addQuestions([newQuestion as Question]);
        revalidatePath('/questions');
        revalidatePath('/random-quiz');

        return {
            success: true,
            newQuestion: newQuestion,
        };
    } catch (error) {
        console.error("Error generating similar question:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}

export async function getAvailableMonthsForYear(year: number) {
    return getAvailableMonths(year);
}
