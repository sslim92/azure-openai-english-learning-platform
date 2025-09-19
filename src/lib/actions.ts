
'use server';

import { 
    getQuestions, 
    type Question, 
    addQuestions, 
    addUserMistake, 
    getAvailableMonths, 
    getQuestionById as getQuestionByIdFromDb, 
    updateListeningScript, 
    upsertUser 
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


export async function uploadPdfAndExtractQuestions(pdfDataUri: string) {
     try {
        const result = await postToAiServer('/extract-questions', { input: { pdfDataUri } });
        if (result && Array.isArray(result.questions)) {
            const questionsToInsert = result.questions.map((q: any) => {
                const { options, ...rest } = q;
                return { ...rest, intent: q.topic };
            });
            const allOptions = result.questions.flatMap((q: any) => 
                q.options.map((o: any) => ({ questionId: q.id, id: o.id, text: o.text }))
            );
            
            await addQuestions(questionsToInsert, allOptions);
            revalidatePath('/questions');
            revalidatePath('/');
            return { success: true, questionCount: result.questions.length };
        } else {
             throw new Error('AI 서버가 유효한 질문 데이터를 반환하지 않았습니다.');
        }
    } catch (error) {
        console.error("Error processing PDF:", error);
        const errorMessage = error instanceof Error ? error.message : "PDF 처리 중 알 수 없는 오류가 발생했습니다.";
        return { success: false, error: errorMessage };
    }
}


export async function uploadScriptsAndMatchToQuestions(pdfDataUri: string, year: number, month: number) {
     try {
        const result = await postToAiServer('/match-scripts', { input: { pdfDataUri, year, month } });

        if (result && Array.isArray(result.scripts)) {
            for (const script of result.scripts) {
                await updateListeningScript(script.questionId, script.script);
            }
            revalidatePath('/questions');
            return { success: true, matchCount: result.scripts.length };
        } else {
            throw new Error('AI 서버가 유효한 스크립트 데이터를 반환하지 않았습니다.');
        }
    } catch (error) {
        console.error("Error processing script PDF:", error);
        const errorMessage = error instanceof Error ? error.message : "스크립트 처리 중 알 수 없는 오류가 발생했습니다.";
        return { success: false, error: errorMessage };
    }
}

export async function getTutorResponse(questionContext: string, weaknessAnalysis: string | null, chatHistory: ChatMessage[]) {
    try {
        const payload = {
            messages: chatHistory,
            context: {
                questionContext: questionContext,
                weaknessAnalysis: weaknessAnalysis,
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


export async function textToSpeech(text: string): Promise<{ success: boolean; audioDataUri?: string; error?: string }> {
    try {
        const result = await postToAiServer('/generate-audio', { text });
        return { success: true, audioDataUri: result.audioDataUri };
    } catch (error) {
        console.error("Error generating audio from AI server:", error);
        const errorMessage = error instanceof Error ? error.message : "음성 생성 중 알 수 없는 오류가 발생했습니다.";
        return { success: false, error: errorMessage };
    }
}

export async function createSimilarQuestion(originalQuestion: Question) {
    try {
        const prompt = `
You are an expert English question creator for the Korean CSAT (Suneung).
A student has answered a question correctly and wants to try a similar one.
Your task is to create a new, original multiple-choice question that is similar to the provided example question but completely distinct.

The new question must be in JSON format and include:
- id: A unique ID starting with 'ai-generated-' and a timestamp.
- subject: Must be 'English'.
- topic: Same as the original question's topic: '${originalQuestion.topic}'.
- questionText: The main question text in KOREAN, and the passage in ENGLISH.
- options: An array of 4-5 option objects, each with 'id' and 'text' in ENGLISH.
- correctOptionId: The ID of the correct option.
- explanation: A detailed explanation in KOREAN.
- difficulty: Similar to the original: '${originalQuestion.difficulty}'.
- generationReason: A concise, one-sentence explanation in KOREAN.

Original Question Context (for reference only, do not copy):
---
Topic: ${originalQuestion.topic}
Difficulty: ${originalQuestion.difficulty}
Question: ${originalQuestion.questionText}
---

Generate a brand new, unique, and high-quality question.
`;
        
        const result = await postToAiServer('/generate-similar', { input: { prompt } });

        if (result && result.id) {
             const newQuestion = { ...result, passage: result.passage || '' };
             const { options, ...rest } = newQuestion;
             const questionsToInsert = [{ ...rest, intent: newQuestion.topic }];
             const optionsToInsert = newQuestion.options.map((o: any) => ({ questionId: newQuestion.id, id: o.id, text: o.text }));
             await addQuestions(questionsToInsert, optionsToInsert);
             revalidatePath('/questions');
             revalidatePath('/');
             return { success: true, newQuestion };
        } else {
            throw new Error('AI 서버가 유효한 유사 문제를 생성하지 못했습니다.');
        }
    } catch (error) {
        console.error("Error creating similar question:", error);
        const errorMessage = error instanceof Error ? error.message : "유사 문제 생성 중 알 수 없는 오류가 발생했습니다.";
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
      선택지: ${JSON.stringify(input.question.options)}
      정답: ${input.question.correctOptionId}
      해설: ${input.question.explanation}
    `;
    const selectedOption = input.question.options.find(o => o.id === input.selectedOptionId);

    const prompt = `
You are an expert English tutor and question creator for the Korean CSAT (Suneung).
A student has answered a question incorrectly. Your task is to perform two steps and return a single JSON object containing 'weaknessAnalysis' and 'generatedQuestion'.

1.  **Analyze the Weakness (in Korean)**: Analyze the student's reasoning for their mistake. Provide a concise, empathetic, and insightful analysis of their core misunderstanding. This will be the value for 'weaknessAnalysis'.

2.  **Generate a New Question**: Based on your analysis, create a completely new, original multiple-choice question that directly targets the student's identified weakness. The new question must be a JSON object with the following fields: id, subject, topic, questionText, options, correctOptionId, explanation, difficulty, generationReason. This will be the value for 'generatedQuestion'.

**Original Question Context:**
---
${questionContext}
---

**Student's Mistake:**
---
- **They Chose:** ${selectedOption?.text || 'N/A'}
- **Their Reason:** ${input.userReason}
---

Now, perform the analysis and generate the new question. All textual output for the user must be in Korean. Return a single JSON object.
`;

    const result = await postToAiServer('/analyze-mistake', { input: { prompt } });

    if (!result || !result.weaknessAnalysis || !result.generatedQuestion) {
      throw new Error('AI 서버가 분석 또는 문제 생성에 실패했습니다.');
    }
    
    const newQuestion = result.generatedQuestion;

    // The AI server call was successful, now we can safely add the mistake to the DB.
    await addUserMistake({
      userId: input.userId,
      questionId: input.question.id,
      selectedOptionKey: input.selectedOptionId,
      reason: input.userReason,
    });
    revalidatePath('/progress');
    
    if (newQuestion && newQuestion.id) {
        const { options, ...rest } = newQuestion;
        const questionToInsert = { ...rest, intent: newQuestion.topic, passage: newQuestion.passage || '' };
        const optionsToInsert = newQuestion.options.map((o: any) => ({ questionId: newQuestion.id, id: o.id, text: o.text }));
        await addQuestions([questionToInsert], optionsToInsert);
        revalidatePath('/questions');
        revalidatePath('/');
    }

    return { 
        success: true, 
        analysis: result.weaknessAnalysis,
        generatedQuestion: newQuestion
    };

  } catch (error) {
    console.error("Error processing user mistake:", error);
    const errorMessage =
      error instanceof Error ? error.message : "오답 처리 중 알 수 없는 오류가 발생했습니다.";
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
    // Fallback for AI-generated questions that might not be in DB immediately
    // This part is less critical now as AI generation is coupled with DB insertion.
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
        await upsertUser({
            userId: user.userId,
            email: user.email,
            displayName: user.displayName || user.email,
        });
        return { success: true };
    } catch (error) {
        console.error('User sync failed:', error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류로 사용자 정보 동기화에 실패했습니다.';
        return { success: false, error: errorMessage };
    }
}
