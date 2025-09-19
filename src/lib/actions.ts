
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

export async function generateCustomExplanation(input: {
    questionText: string;
    passage: string;
    options: Array<{id: string, text: string}>;
    correctOptionId: string;
    selectedOptionId: string;
    originalExplanation: string;
}) {
  try {
    // analyzer 에이전트에게 순수 JSON 데이터만 전송
    const questionData = {
      questionText: input.questionText,
      passage: input.passage,
      options: input.options,
      correctOptionId: input.correctOptionId,
      selectedOptionId: input.selectedOptionId,
      originalExplanation: input.originalExplanation
    };

    const resp = await fetch(`${AI_SERVER_BASE_URL}/agent-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'analyzer',
        messages: [{ 
          role: 'user', 
          content: JSON.stringify(questionData)
        }],
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn(`AI analysis failed (${resp.status}):`, text);
      
      // Fallback: 기본 메시지 반환
      const correctOption = input.options.find(o => o.id === input.correctOptionId);
      return { 
        success: true, 
        explanation: `정답은 '${correctOption?.text}'입니다.\n\n${input.originalExplanation}\n\n괜찮습니다. 메기와 함께 꾸준히 학습해 나가요!` 
      };
    }

    const data = await resp.json().catch(() => ({}));
    
    // AI 응답이 있으면 정답과 함께 표시
    if (data?.message) {
      const correctOption = input.options.find(o => o.id === input.correctOptionId);
      return { 
        success: true, 
        explanation: `정답은 '${correctOption?.text}'입니다.\n\n${data.message}` 
      };
    } else {
      // AI 응답이 없으면 Fallback
      const correctOption = input.options.find(o => o.id === input.correctOptionId);
      return { 
        success: true, 
        explanation: `정답은 '${correctOption?.text}'입니다.\n\n${input.originalExplanation}\n\n괜찮습니다. 메기와 함께 꾸준히 학습해 나가요!` 
      };
    }
    
  } catch (error) {
    console.error('Custom explanation generation failed:', error);
    
    // Fallback: 기본 메시지 반환
    const correctOption = input.options.find(o => o.id === input.correctOptionId);
    return { 
      success: true, 
      explanation: `정답은 '${correctOption?.text}'입니다.\n\n${input.originalExplanation}\n\n괜찮습니다. 메기와 함께 꾸준히 학습해 나가요!` 
    };
  }
}

export async function getTutorResponse(
    questionContext: string, 
    analysis: string, 
    chatHistory: Array<{role: string, content: string}>
): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
        // JSON 데이터 구성 - 서버에서 프롬프트 작성하도록 데이터만 전송
        const tutorData = {
            questionContext: questionContext,
            analysis: analysis,
            chatHistory: chatHistory
        };

        const resp = await fetch(`${AI_SERVER_BASE_URL}/agent-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent: 'tutor',
                messages: [{ 
                    role: 'user', 
                    content: JSON.stringify(tutorData)
                }],
                temperature: 0.7,
            }),
        });

        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            console.warn(`AI tutor response failed (${resp.status}):`, text);
            
            // Fallback: 기본 응답 반환
            return { 
                success: true, 
                response: "안녕하세요! 메기입니다. 질문이 있으시면 언제든 말씀해주세요. 함께 영어 실력을 키워나가요!" 
            };
        }

        const data = await resp.json().catch(() => ({}));
        
        if (data?.message) {
            return { 
                success: true, 
                response: data.message 
            };
        } else {
            // AI 응답이 없으면 Fallback
            return { 
                success: true, 
                response: "안녕하세요! 메기입니다. 질문이 있으시면 언제든 말씀해주세요. 함께 영어 실력을 키워나가요!" 
            };
        }
        
    } catch (error) {
        console.error('Tutor response generation failed:', error);
        
        // Fallback: 기본 응답 반환
        return { 
            success: true, 
            response: "안녕하세요! 메기입니다. 질문이 있으시면 언제든 말씀해주세요. 함께 영어 실력을 키워나가요!" 
        };
    }
}

// 새로운 함수: 사용자 답변 저장 + AI 분석 (유사 문제 생성 제거)
export async function saveUserAnswer(input: {
    userId: string;
    questionId: string;
    questionContext: string;
    selectedOptionId: string;
    selectedOptionText: string;
    userReason: string;
    isCorrect: boolean;
}) {
    try {
        // 오답일 때만 DB에 저장
        if (!input.isCorrect) {
            const mistakeRecord: UserMistake = {
                userId: input.userId,
                questionId: input.questionId,
                selectedOptionKey: input.selectedOptionId,
                reason: input.userReason,
            };
            await addUserMistake(mistakeRecord);
            await revalidatePath('/progress');
        }

        // 오답일 때만 AI 분석 수행
        if (!input.isCorrect) {
            // JSON 데이터 구성 - 서버에서 프롬프트 작성하도록 데이터만 전송
            const analysisData = {
                questionContext: input.questionContext,
                selectedOptionText: input.selectedOptionText,
                userReason: input.userReason,
                analysisType: "mistake_analysis"
            };

            const analysisResp = await fetch(`${AI_SERVER_BASE_URL}/agent-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent: 'analyzer',
                    messages: [{ 
                        role: 'user', 
                        content: JSON.stringify(analysisData)
                    }],
                    temperature: 0.2,
                }),
            });

            if (!analysisResp.ok) {
                const text = await analysisResp.text().catch(() => '');
                throw new Error(`AI server error: ${analysisResp.status} ${text}`);
            }

            const analysisResult = await analysisResp.json().catch(() => ({}));
            const analysis = analysisResult?.message || "분석을 완료했습니다.";

            return {
                success: true,
                analysis: analysis,
                isCorrect: false
            };
        }

        // 정답일 때
        return {
            success: true,
            analysis: "정답입니다! 잘하셨어요.",
            isCorrect: true
        };

    } catch (error) {
        console.error('Save user answer failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'An unknown error occurred during answer processing.'
        };
    }
}

// 기존 함수 유지 (하위 호환성을 위해)
export async function processUserMistake(input: {
    userId: string;
    questionId: string;
    questionContext: string;
    selectedOptionId: string;
    selectedOptionText: string;
    userReason: string;
}) {
    try {
        // 새로운 함수 호출
        const saveResult = await saveUserAnswer({
            ...input,
            isCorrect: false // 이 함수는 오답 처리용이므로 항상 false
        });

        if (!saveResult.success) {
            throw new Error(saveResult.error || 'Answer save failed');
        }

        // 유사 문제 생성은 별도로 유지
        const originalQuestion = await fetchQuestionById(input.questionId);
        if (!originalQuestion) {
            throw new Error('Original question not found');
        }

        const generationResult = await createSimilarQuestion(originalQuestion);
        if (!generationResult.success || !generationResult.newQuestion) {
            throw new Error(generationResult.error || '새로운 문제 생성에 실패했습니다.');
        }

        return {
            success: true,
            analysis: saveResult.analysis,
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

        const resp = await fetch(`${AI_SERVER_BASE_URL}/generate-similar`, {
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
        await revalidatePath('/questions');
        await revalidatePath('/random-quiz');

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
