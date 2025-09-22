
'use server';

import { 
    getQuestions, 
    type Question, 
    type UserMistake,
    addQuestions, 
    addUserMistake, 
    getAvailableMonths, 
    getQuestionById as getQuestionByIdFromDb, 
    updateListeningScript, 
    upsertUser as upsertUserToDb,
    type UserProfile,
    getUserProfile as getUserProfileFromDb,
    updateUserCatfishExperience,
    addUserAnswer,
    getUserStats as getUserStatsFromDb,
    type UserStats,
    getUserById
} from '@/lib/data';
import { revalidatePath } from 'next/cache';
import type { ChatMessage } from '@/components/ai-mentor';

const AI_SERVER_BASE_URL = 'http://127.0.0.1:8001/v1';

async function postToAiServer(endpoint: string, body: object) {
    try {
        const response = await fetch(`${AI_SERVER_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`AI Server Error (${response.status}) on ${endpoint}:`, errorBody);
            throw new Error(`AI 서버 요청 실패: ${response.status} ${response.statusText}. 상세: ${errorBody}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Fetch failed for AI server endpoint ${endpoint}:`, error);
        if (error instanceof Error && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))) {
             throw new Error(`AI 서버(${AI_SERVER_BASE_URL})에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.`);
        }
        throw error;
    }
}




export async function getTutorResponse(questionContext: string, analysis: string | null, chatHistory: ChatMessage[]) {
    try {
        const payload = {
            agent: 'tutor',
            messages: chatHistory,
            context: {
                questionContext: questionContext,
                weaknessAnalysis: analysis,
            }
        };
        const result = await postToAiServer('/agent-chat', payload);
        return { success: true, response: result.message };
    } catch (error) {
        console.error("Error getting tutor response from AI server:", error);
        const errorMessage = error instanceof Error ? error.message : "AI 튜터 응답을 가져오는 중 알 수 없는 오류가 발생했습니다.";
        return { success: false, error: errorMessage };
    }
}

export async function generateCustomExplanation(input: {
  question: Question;
  selectedOptionId: string;
}): Promise<{ success: boolean; explanation?: string; error?: string; }> {
  try {
    const selectedOption = input.question.options.find(o => o.id === input.selectedOptionId);
    
    const payload = {
      agent: 'analyzer',
      messages: [],
      context: {
        analysisType: 'custom_explanation',
        questionText: input.question.questionText,
        passage: input.question.passage || '',
        listeningScript: input.question.listeningScript || '',
        options: input.question.options,
        correctOptionId: input.question.correctOptionId,
        selectedOptionId: input.selectedOptionId,
        selectedOptionText: selectedOption?.text || '',
        originalExplanation: input.question.explanation
      }
    };

    const result = await postToAiServer('/agent-chat', payload);
    
    if (!result || !result.message) {
      throw new Error('AI 서버가 맞춤 해설을 생성하지 못했습니다.');
    }

    return { success: true, explanation: result.message };
  } catch (error) {
    console.error("Error generating custom explanation:", error);
    const errorMessage = error instanceof Error ? error.message : "맞춤 해설 생성 중 알 수 없는 오류가 발생했습니다.";
    return { success: false, error: errorMessage };
  }
}

export async function processUserSubmission(input: {
  userId: string;
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
}): Promise<{ success: boolean; error?: string; }> {
  if (!input.userId || !input.questionId || !input.selectedOptionId) {
    return { success: false, error: '사용자, 질문, 또는 선택한 답변 정보가 누락되었습니다.' };
  }
  
  try {
    const dbOperations: Promise<any>[] = [
      addUserAnswer({
        userId: input.userId,
        questionId: input.questionId,
        selectedOptionId: input.selectedOptionId,
        isCorrect: input.isCorrect,
      })
    ];

    if (input.isCorrect) {
      const XP_PER_CORRECT_ANSWER = 10;
      dbOperations.push(updateUserCatfishExperience(input.userId, XP_PER_CORRECT_ANSWER));
    }

    await Promise.all(dbOperations);
    
    revalidatePath('/progress');
    revalidatePath('/'); // For dashboard updates
    revalidatePath('/layout'); // For sidebar updates

    return { success: true };

  } catch (error) {
    console.error("Error processing user submission in actions.ts:", error);
    const errorMessage =
      error instanceof Error ? error.message : "답안 제출 처리 중 알 수 없는 오류가 발생했습니다.";
    return { success: false, error: errorMessage };
  }
}

export async function processUserMistake(input: {
  userId: string;
  question: Question;
  selectedOptionId: string;
  userReason: string;
}): Promise<{
  success: boolean;
  analysis?: string;
  generatedQuestion?: Question;
  error?: string;
}> {
  if (!input.userId || typeof input.userId !== 'string' || input.userId.trim() === '') {
    return { success: false, error: '잘못되었거나 존재하지 않는 사용자 ID입니다. 로그인 해주세요.' };
  }
  if (!input.question) {
    return { success: false, error: '질문 정보가 누락되었습니다.' };
  }

  try {
    const questionContext = `
      문제: ${input.question.questionText}
      본문: ${input.question.passage || ''}
      선택지: ${JSON.stringify(input.question.options)}
      정답: ${input.question.correctOptionId}
      해설: ${input.question.explanation}
    `;
    const selectedOption = input.question.options.find(o => o.id === input.selectedOptionId);

    const payload = {
      agent: 'analyzer',
      messages: [],
      context: {
        analysisType: 'mistake_analysis',
        questionContext: questionContext,
        selectedOptionText: selectedOption?.text || 'N/A',
        userReason: input.userReason
      }
    };

    const analysisResult = await postToAiServer('/agent-chat', payload);

    if (!analysisResult || !analysisResult.message) {
      throw new Error('AI 서버가 분석 응답을 생성하지 못했습니다.');
    }
    
    // Now generate a question based on the analysis
    const generationPayload = {
      input: {
          topic: input.question.topic,
          difficulty: input.question.difficulty,
          questionText: input.question.questionText,
          correctOptionId: input.question.correctOptionId,
          explanation: `학생의 약점 분석: ${analysisResult.message}\n\n기존 해설: ${input.question.explanation}`
      }
    };
    const generatedQuestionResult = await postToAiServer('/generate-similar', generationPayload);

    if (!generatedQuestionResult || !generatedQuestionResult.id) {
       throw new Error('AI 서버가 약점 기반 문제를 생성하지 못했습니다.');
    }

    const newQuestion = { ...generatedQuestionResult, passage: generatedQuestionResult.passage || '' };
    newQuestion.generationReason = `이전 문제에서 발견된 약점(${analysisResult.message.substring(0, 50)}...)을 보완하기 위해 생성된 문제입니다.`;

    await addUserMistake({
      userId: input.userId,
      questionId: input.question.id,
      selectedOptionKey: input.selectedOptionId,
      reason: input.userReason,
    });
    revalidatePath('/progress');
    
    const { options, ...rest } = newQuestion;
    const questionToInsert = { ...rest, intent: newQuestion.topic, passage: newQuestion.passage || '' };
    const optionsToInsert = newQuestion.options.map((o: any) => ({ questionId: newQuestion.id, id: o.id, text: o.text }));
    await addQuestions([questionToInsert], optionsToInsert);
    revalidatePath('/questions');
    revalidatePath('/');

    return { 
        success: true, 
        analysis: analysisResult.message,
        generatedQuestion: newQuestion
    };

  } catch (error) {
    console.error("Error processing user mistake:", error);
    const errorMessage =
      error instanceof Error ? error.message : "오답 처리 중 알 수 없는 오류가 발생했습니다.";
    return { success: false, error: errorMessage };
  }
}


export async function textToSpeech(text: string): Promise<{ success: boolean; audioDataUri?: string; error?: string }> {
    try {
        const result = await postToAiServer('/generate-audio', { text });
        return { success: true, audioDataUri: result.audioDataUri };
    } catch (error) {
        console.error('Text to speech failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "음성 생성 중 알 수 없는 오류가 발생했습니다."
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

        const resp = await postToAiServer('/generate-similar', { input: { prompt: aiInputObj } });
        
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`AI server error: ${resp.status} ${text}`);
        }
        
        const newQuestion = await resp.json().catch(() => ({} as any));
        const q = newQuestion as Question;
        
        if (!q || !q.id) {
            throw new Error('AI server did not return a valid question');
        }
        
        const { options, ...rest } = q;
        const questionRecord = { ...rest, intent: q.topic, passage: q.passage || '' };
        
        const optionsRecords = (q.options ?? []).map(o => ({
            questionId: q.id,
            id: o.id,
            text: o.text,
        }));

        await addQuestions([questionRecord], optionsRecords);
        revalidatePath('/questions');
        revalidatePath('/random-quiz');

        return {
            success: true,
            newQuestion: q,
        };
        
    } catch (error) {
        console.error("Error creating similar question:", error);
        const errorMessage = error instanceof Error ? error.message : "유사 문제 생성 중 알 수 없는 오류가 발생했습니다.";
        return { success: false, error: errorMessage };
    }
}


// --- Server Actions for data fetching and auth ---

export async function fetchAllQuestions(): Promise<Question[]> {
    return getQuestions();
}

export async function fetchQuestionById(id: string): Promise<Question | null> {
    const question = await getQuestionByIdFromDb(id);
    if (question) {
        return question;
    }
    return null;
}


export async function getAvailableYears(): Promise<number[]> {
    const questions = await getQuestions();
    const years = new Set(questions.map(q => q.year).filter((y): y is number => y !== undefined));
    return Array.from(years).sort((a, b) => b - a);
}

export async function getAvailableMonthsForYear(year: number) {
    return getAvailableMonths(year);
}


export async function syncUser(user: {userId: string; email: string; displayName: string | null }): Promise<{ success: boolean; error?: string }> {
    try {
        await upsertUserToDb({
            userId: user.userId,
            email: user.email,
            displayName: user.displayName, // Pass displayName as is, don't fallback to email part
        });
        return { success: true };
    } catch (error) {
        console.error('User sync failed:', error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류로 사용자 정보 동기화에 실패했습니다.';
        return { success: false, error: errorMessage };
    }
}

export async function upsertUser(user: {userId: string; email: string; displayName: string | null }): Promise<{ success: boolean; error?: string }> {
    try {
        await upsertUserToDb(user);
        return { success: true };
    } catch (error) {
        console.error('Upsert user failed:', error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류로 사용자 정보 저장/업데이트에 실패했습니다.';
        return { success: false, error: errorMessage };
    }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    return getUserProfileFromDb(userId);
}

export async function getUserStats(userId: string): Promise<UserStats> {
    return getUserStatsFromDb(userId);
}
