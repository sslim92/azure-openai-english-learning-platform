
"use server";

// Avoid requiring @types/node in the repo; runtime access is guarded below
declare const process: any;

import { getQuestions, type Question, addQuestions, addUserMistake, type UserMistake, getAvailableMonths } from '@/lib/data';
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
        const mistakeRecord: Omit<UserMistake, 'id' | 'timestamp'> = {
            userId: input.userId,
            questionId: input.questionId,
            selectedOptionId: input.selectedOptionId,
            reason: input.userReason,
        };
  await addUserMistake(mistakeRecord);
  await safeRevalidatePath('/progress');

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
  await safeRevalidatePath('/questions');
  await safeRevalidatePath('/random-quiz');

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
  await safeRevalidatePath('/questions');
  await safeRevalidatePath('/random-quiz');

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
