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

export async function generateCustomExplanation(input: {
    questionText: string;
    passage: string;
    options: Array<{id: string, text: string}>;
    correctOptionId: string;
    selectedOptionId: string;
    originalExplanation: string;
}) {
  try {
    // 맞춤 해설 생성 프롬프트 구성
    const explanationPrompt = `
다음 영어 문제에 대해 학생이 오답을 선택했습니다. 학생에게 맞춤형 해설을 제공해주세요.

문제: ${input.questionText}
본문: ${input.passage}
선택지: ${input.options.map(o => `${o.id}: ${o.text}`).join('\n')}

정답: ${input.correctOptionId}
학생이 선택한 답: ${input.selectedOptionId}

기존 해설: ${input.originalExplanation}

위 정보를 바탕으로 학생이 왜 틀렸는지 분석하고, 이해하기 쉬운 맞춤형 해설을 제공해주세요. 
메기 멘토의 따뜻한 말투로 격려하면서 설명해주세요.
    `.trim();

    // analyzer 에이전트를 통한 맞춤 해설 생성
    const resp = await fetch(`${AI_SERVER_BASE}/v1/agent-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'analyzer',
        messages: [{ role: 'user', content: explanationPrompt }],
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AI server error: ${resp.status} ${text}`);
    }

    const data = await resp.json().catch(() => ({}));
    return { success: true, explanation: data?.message };
    
  } catch (error) {
    console.error('Custom explanation generation failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred during explanation generation.' 
    };
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

        // AI 분석용 프롬프트 구성
        const analysisPrompt = `
문제 분석 요청:

문제 정보:
${input.questionContext}

학생이 선택한 답: ${input.selectedOptionText}
학생의 선택 이유: ${input.userReason}

위 정보를 바탕으로 학생의 오답 원인을 분석하고, 어떤 영어 개념에서 약점이 있는지 파악해주세요.
        `.trim();

        // analyzer 에이전트를 통한 오답 분석
        const analysisResp = await fetch(`${AI_SERVER_BASE}/v1/agent-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent: 'analyzer',
                messages: [{ role: 'user', content: analysisPrompt }],
                context: {
                    questionContext: input.questionContext,
                },
                temperature: 0.2,
            }),
        });

        if (!analysisResp.ok) {
            const text = await analysisResp.text().catch(() => '');
            throw new Error(`AI server error: ${analysisResp.status} ${text}`);
        }

        const analysisResult = await analysisResp.json().catch(() => ({}));
        const analysis = analysisResult?.message || "분석을 완료했습니다.";

        // 원본 문제 정보에서 새로운 문제 생성
        const originalQuestion = await getQuestionById(input.questionId);
        if (!originalQuestion) {
            throw new Error('Original question not found');
        }

        const generationResult = await createSimilarQuestion(originalQuestion);
        if (!generationResult.success || !generationResult.newQuestion) {
            throw new Error(generationResult.error || '새로운 문제 생성에 실패했습니다.');
        }

        return {
            success: true,
            analysis: analysis,
            newQuestion: generationResult.newQuestion
        };

    } catch (error) {
        console.error('Process user mistake failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'An unknown error occurred during mistake processing.'
        };
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

        const resp = await fetch(`${AI_SERVER_BASE}/v1/generate-similar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: { prompt: aiInputObj } }),
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
        
        // 데이터베이스에 저장
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
