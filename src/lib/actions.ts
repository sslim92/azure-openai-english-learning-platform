
"use server";

import { getQuestions, type Question, addQuestions, updateQuestionsWithScripts, addUserMistake, type UserMistake, getAvailableMonths } from '@/lib/data';
// NOTE: AI calls are proxied to a local Python FastAPI server (see ai_server/).
const AI_SERVER_BASE = process.env.AI_SERVER_BASE ?? 'http://localhost:8001';
import { revalidatePath } from 'next/cache';


export async function uploadPdfAndExtractQuestions(pdfDataUri: string, fileName: string) {
  try {
    if (!pdfDataUri.startsWith('data:application/pdf;base64,')) {
        throw new Error('잘못된 데이터 URI입니다. Base64로 인코딩된 PDF여야 합니다.');
    }

    // Call python AI server to extract questions
    const resp = await fetch(`${AI_SERVER_BASE}/v1/extract-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { prompt: pdfDataUri } }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AI server error: ${resp.status} ${text}`);
    }
    const result = await resp.json().catch(() => ({}));

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

    const resp = await fetch(`${AI_SERVER_BASE}/v1/match-scripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { prompt: { pdfDataUri, year, month } } }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AI server error: ${resp.status} ${text}`);
    }
    const result = await resp.json().catch(() => ({}));
    
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


export async function getTutorResponse(questionContext: string, weaknessAnalysis: string | null, chatHistory: any) {
  try {
    const messages = [
      { role: 'system', content: 'You are a helpful AI tutor.' },
      { role: 'user', content: `${questionContext}\nWeaknessAnalysis:${weaknessAnalysis ?? ''}` },
      ...chatHistory,
    ];

    const resp = await fetch(`${AI_SERVER_BASE}/v1/conversational-tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { messages } }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AI server error: ${resp.status} ${text}`);
    }
    const data = await resp.json().catch(() => ({}));
    return { success: true, response: data };
  } catch (error) {
    console.error('Tutor response failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred during tutor conversation.' };
  }
}

export async function textToSpeech(text: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const resp = await fetch(`${AI_SERVER_BASE}/v1/generate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AI server error: ${resp.status} ${text}`);
    }
    const data = await resp.json().catch(() => ({}));
    return { success: true, data };
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

    const aiInput = {
      questionContext: input.questionContext,
      userAnswerText: input.selectedOptionText,
      userReason: input.userReason,
    };
        // call python AI server to analyze mistake and generate question
        const resp = await fetch(`${AI_SERVER_BASE}/v1/analyze-mistake`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { prompt: aiInput } }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`AI server error: ${resp.status} ${text}`);
        }
        const aiResult = await resp.json().catch(() => ({}));

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
    const aiInput = {
      topic: originalQuestion.topic,
      difficulty: originalQuestion.difficulty,
      questionText: originalQuestion.questionText,
      correctOptionId: originalQuestion.correctOptionId,
      explanation: originalQuestion.explanation,
    };

        const resp = await fetch(`${AI_SERVER_BASE}/v1/generate-similar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { prompt: aiInput } }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`AI server error: ${resp.status} ${text}`);
        }
        const newQuestion = await resp.json().catch(() => ({}));

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
