"use server";

// Avoid requiring @types/node in the repo; runtime access is guarded below
declare const process: any;

import { getQuestions, getQuestionById, type Question, addQuestions, addUserMistake, type UserMistake, getAvailableMonths } from '@/lib/data';
// NOTE: AI calls are proxied to a local Python FastAPI server (see ai_server/).
const AI_SERVER_BASE = process?.env?.AI_SERVER_BASE ?? 'http://localhost:8001';

// Use a runtime import for next/cache so TypeScript doesn't require build-time types
async function safeRevalidatePath(path: string) {
  try {
    // @ts-ignore - dynamic import; next/cache types may not be present in this environment
    const mod = await import('next/cache');
    const fn = (mod as any)?.revalidatePath ?? (mod as any)?.unstable_revalidatePath;
    if (typeof fn === 'function') fn(path);
  } catch (err) {
    // running outside Next or types missing; ignore
  }
}


// PDF 관련 기능은 제거되었습니다.


export async function getTutorResponse(questionContext: string, weaknessAnalysis: string | null, chatHistory: any) {
  try {
    const messages = [...chatHistory];
    const resp = await fetch(`${AI_SERVER_BASE}/v1/agent-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'tutor',
        messages,
        context: {
          questionContext,
          weaknessAnalysis: weaknessAnalysis ?? undefined,
        },
        temperature: 0.2,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AI server error: ${resp.status} ${text}`);
    }
    const data = await resp.json().catch(() => ({}));
    return { success: true, response: data?.message };
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
    // DB에 저장할 오답 기록 형태로 매핑 (data.ts의 UserMistake 시그니처와 동일)
    const mistakeRecord: UserMistake = {
            userId: input.userId,
            questionId: input.questionId,
            selectedOptionKey: input.selectedOptionId,
            reason: input.userReason,
        };
  await addUserMistake(mistakeRecord);
  await safeRevalidatePath('/progress');

    const aiInputObj = {
      questionContext: input.questionContext,
      userAnswerText: input.selectedOptionText,
      userReason: input.userReason,
    };
    // Convert ai input object into a readable prompt string for the backend
    const aiPrompt = `questionContext: ${aiInputObj.questionContext}\nuserAnswerText: ${aiInputObj.userAnswerText}\nuserReason: ${aiInputObj.userReason}`;
        // call python AI server to analyze mistake and generate question
        const resp = await fetch(`${AI_SERVER_BASE}/v1/analyze-mistake`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { prompt: aiPrompt } }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`AI server error: ${resp.status} ${text}`);
        }
        const aiResult = await resp.json().catch(() => ({} as any));

        // AI 서버가 반환한 신규 문항을 Question 형태로 가정하고 DB 배치 API 형식으로 분해
        const newQuestion = aiResult.generatedQuestion as Question;
        if (!newQuestion || !newQuestion.id) {
          throw new Error('AI server did not return a valid generatedQuestion');
        }
        const questionRecord: Omit<Question, 'options'> = {
          id: newQuestion.id,
          year: newQuestion.year,
          month: newQuestion.month,
          intent: newQuestion.intent,
          topic: newQuestion.topic,
          questionText: newQuestion.questionText,
          passage: newQuestion.passage,
          correctOptionId: newQuestion.correctOptionId,
          explanation: newQuestion.explanation,
          difficulty: newQuestion.difficulty,
          listeningScript: newQuestion.listeningScript,
          generationReason: newQuestion.generationReason,
        };
        const optionsRecords = (newQuestion.options ?? []).map(o => ({
          questionId: newQuestion.id,
          id: o.id,
          text: o.text,
        }));

        await addQuestions([questionRecord], optionsRecords);
        await safeRevalidatePath('/questions');
        await safeRevalidatePath('/random-quiz');

        return {
            success: true,
            analysis: aiResult.weaknessAnalysis,
            newQuestion,
        };

    } catch (error) {
        console.error("Error processing user mistake:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}


export async function createSimilarQuestion(originalQuestion: Question) {
     try {
    const aiInputObj = {
      topic: originalQuestion.topic,
      difficulty: originalQuestion.difficulty,
      questionText: originalQuestion.questionText,
      correctOptionId: originalQuestion.correctOptionId,
      explanation: originalQuestion.explanation,
    };
    const aiPrompt = `topic: ${aiInputObj.topic}\ndifficulty: ${aiInputObj.difficulty}\nquestionText: ${aiInputObj.questionText}\ncorrectOptionId: ${aiInputObj.correctOptionId}\nexplanation: ${aiInputObj.explanation}`;

        const resp = await fetch(`${AI_SERVER_BASE}/v1/generate-similar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { prompt: aiPrompt } }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`AI server error: ${resp.status} ${text}`);
        }
        const newQuestion = await resp.json().catch(() => ({} as any));

        const q = newQuestion as Question;
        if (!q || !q.id) {
          throw new Error('AI server did not return a valid question');
        }
        const questionRecord: Omit<Question, 'options'> = {
          id: q.id,
          year: q.year,
          month: q.month,
          intent: q.intent,
          topic: q.topic,
          questionText: q.questionText,
          passage: q.passage,
          correctOptionId: q.correctOptionId,
          explanation: q.explanation,
          difficulty: q.difficulty,
          listeningScript: q.listeningScript,
          generationReason: q.generationReason,
        };
        const optionsRecords = (q.options ?? []).map(o => ({
          questionId: q.id,
          id: o.id,
          text: o.text,
        }));

        await addQuestions([questionRecord], optionsRecords);
        await safeRevalidatePath('/questions');
        await safeRevalidatePath('/random-quiz');

        return {
            success: true,
            newQuestion: q,
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
  return getQuestionById(id);
}


export async function getAvailableYears(): Promise<number[]> {
    const questions = await getQuestions();
    const years = new Set(questions.map(q => q.year).filter((y): y is number => y !== undefined));
    return Array.from(years).sort((a, b) => b - a);
}

export async function getAvailableMonthsForYear(year: number) {
    return getAvailableMonths(year);
}
