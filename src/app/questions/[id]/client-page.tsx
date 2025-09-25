
'use client';

import { useState, useEffect } from 'react';
import { type Question } from '@/lib/data';
import QuestionDisplay from '@/components/question-display';
import AiMentor from '@/components/ai-mentor';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getTutorResponse, processUserMistake, createSimilarQuestion, textToSpeech, processUserSubmission, generateCustomExplanation } from '@/lib/actions';
import type { ChatMessage } from '@/components/ai-mentor';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

// Defines the possible interaction modes with the AI mentor
export type MentorInteraction = 'idle' | 'analyzing' | 'tutoring' | 'generating' | 'generationComplete';

interface QuestionClientPageProps {
  initialQuestion: Question;
}

export default function QuestionClientPage({ initialQuestion }: QuestionClientPageProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question>(initialQuestion);
  
  const [mentorInteraction, setMentorInteraction] = useState<MentorInteraction>('idle');
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuestionId, setGeneratedQuestionId] = useState<string | null>(null);

  // State for conversational tutor
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();


  useEffect(() => {
    // Reset state if the initial question ID changes
    if (initialQuestion.id !== currentQuestion.id) {
      setCurrentQuestion(initialQuestion);
      resetState();
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const resetState = () => {
    setIsSubmitted(false);
    setIsCorrect(null);
    setSelectedOptionId(null);
    setAnalysis(null);
    setError(null);
    setChatHistory([]);
    setMentorInteraction('idle');
    setGeneratedQuestionId(null);
  };

  const handleAnswerSubmit = async (selectedOptionId: string) => {
    if (!user) {
        toast({
            variant: "destructive",
            title: "로그인 필요",
            description: "답안을 제출하고 기록하려면 로그인이 필요합니다.",
        });
        router.push('/login');
        return;
    }

    setIsSubmitted(true);
    setSelectedOptionId(selectedOptionId);
    setError(null);
    setAnalysis(null);
    setChatHistory([]);
    setGeneratedQuestionId(null);

    const correct = selectedOptionId === currentQuestion.correctOptionId;
    setIsCorrect(correct);
    setMentorInteraction('tutoring'); // Default to tutoring mode after any submission

    // Save submission to DB
    try {
        const result = await processUserSubmission({
            userId: user.uid,
            questionId: currentQuestion.id,
            selectedOptionId: selectedOptionId,
            isCorrect: correct,
        });
        if (!result.success) {
            throw new Error(result.error || '답안 제출 기록에 실패했습니다.');
        }
    } catch (dbError) {
        console.error("Failed to save user submission", dbError);
        toast({
            variant: "destructive",
            title: "기록 저장 실패",
            description: dbError instanceof Error ? dbError.message : "답변 기록을 저장하는 데 문제가 발생했습니다.",
        });
    }
    
    if (correct) {
      setChatHistory([{ role: 'model', content: '훌륭해요, 이번 물살은 잘 타셨네요! 개념을 확실히 다지기 위해 AI가 만든 유사 문제를 풀어보시겠어요? 또는 궁금한 점이 있다면 질문해주세요.' }]);
    } else {
      // 오답 시 맞춤 해설 생성 요청
      try {
        const explanationResult = await generateCustomExplanation({
          question: currentQuestion,
          selectedOptionId: selectedOptionId
        });
        
        if (explanationResult.success && explanationResult.explanation) {
          setChatHistory([{ role: 'model', content: explanationResult.explanation }]);
        } else {
          // 실패 시 기본 메시지 사용
          setChatHistory([{ role: 'model', content: `아쉽지만 정답을 살짝 비껴갔네요. 정답은 '${currentQuestion.options.find(o => o.id === currentQuestion.correctOptionId)?.text}'입니다.\n\n해설: ${currentQuestion.explanation}\n\n괜찮습니다. 메기도 가끔 물길을 헤매다 길을 찾곤 하죠. 해설을 보고 궁금한 점을 질문하시거나, AI 약점 분석을 받아보세요.` }]);
        }
      } catch (error) {
        console.error('Custom explanation error:', error);
        // 에러 시 기본 메시지 사용
        setChatHistory([{ role: 'model', content: `아쉽지만 정답을 살짝 비껴갔네요. 정답은 '${currentQuestion.options.find(o => o.id === currentQuestion.correctOptionId)?.text}'입니다.\n\n해설: ${currentQuestion.explanation}\n\n괜찮습니다. 메기도 가끔 물길을 헤매다 길을 찾곤 하죠. 해설을 보고 궁금한 점을 질문하시거나, AI 약점 분석을 받아보세요.` }]);
      }
    }
  };

  const handleReasonSubmit = async (userReason: string) => {
     if (authLoading) {
        toast({
            variant: "destructive",
            title: "잠시만 기다려주세요",
            description: "사용자 정보를 동기화하는 중입니다. 잠시 후 다시 시도해주세요.",
            duration: 3000,
        });
        return;
    }
     if (!user || !user.uid) {
        toast({
            variant: "destructive",
            title: "로그인 필요",
            description: "약점 분석 기능을 사용하려면 로그인이 필요합니다. 먼저 로그인해주세요.",
            duration: 5000,
        });
        router.push('/login');
        return;
    }

    setMentorInteraction('analyzing');
    const selectedOption = currentQuestion.options.find(o => o.id === (document.querySelector('input[name="question-options"]:checked') as HTMLInputElement)?.value);

    if (!selectedOption) {
        setError("선택한 답변을 찾을 수 없습니다.");
        setMentorInteraction('tutoring'); // Revert to tutoring
        return;
    }
    
    try {
        const result = await processUserMistake({
            userId: user.uid,
            question: currentQuestion, // Pass the entire question object
            selectedOptionId: selectedOption.id,
            userReason: userReason
        });

        if (!result.success || !result.analysis || !result.generatedQuestion) {
            throw new Error(result.error || 'AI 약점 분석 및 문제 생성에 실패했습니다.');
        }

        setAnalysis(result.analysis);
        setGeneratedQuestionId(result.generatedQuestion.id);
        
        toast({
            title: "✅ AI 약점 분석 완료!",
            description: "AI 메기 멘토가 당신의 약점을 보완할 새로운 문제를 만들었습니다.",
        });

        setMentorInteraction('generationComplete');

    } catch (err) {
       const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
       setError(errorMessage);
       setChatHistory(prev => [...prev, { role: 'model', content: `오류가 발생했습니다: ${errorMessage}` }]);
       setMentorInteraction('tutoring'); // Allow chatting even on error
    }
  }

  const handleGenerateSimilar = async () => {
    setMentorInteraction('generating');
    try {
        const result = await createSimilarQuestion(currentQuestion);

        if (!result.success || !result.newQuestion) {
            throw new Error(result.error || '유사 문제 생성에 실패했습니다.');
        }
        
        setChatHistory(prev => [...prev, {role: 'model', content: '좋은 흐름이에요! 이 감각을 이어갈 새로운 문제를 준비했습니다. 아래 버튼을 눌러 바로 도전해보세요.'}]);
        setGeneratedQuestionId(result.newQuestion.id);
        
        toast({
            title: "✅ 유사 문제 도착!",
            description: "AI 메기 멘토가 비슷한 유형의 새로운 문제를 만들었습니다.",
        });

        setMentorInteraction('generationComplete');

    } catch (err) {
       const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
       setError(errorMessage);
       setChatHistory(prev => [...prev, { role: 'model', content: `오류가 발생했습니다: ${errorMessage}` }]);
       setMentorInteraction('tutoring');
    }
  }


  const handleTutorSubmit = async (userInput: string) => {
    if (!userInput.trim() || isTutorLoading) return;

    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userInput }];
    setChatHistory(newHistory);
    setIsTutorLoading(true);
    
    try {
        const questionContext = `
        - 문제: ${currentQuestion.questionText}
        - 본문: ${currentQuestion.passage || ''}
        - 선택지: ${currentQuestion.options.map(o => `${o.id}: ${o.text}`).join(', ')}
        - 정답: ${currentQuestion.correctOptionId}
        - 해설: ${currentQuestion.explanation}
        `;
        
        const result = await getTutorResponse(questionContext, analysis, newHistory);

        if (!result.success || !result.response) {
            throw new Error(result.error || 'AI 튜터로부터 답변을 받지 못했습니다.');
        }

        setChatHistory(prev => [...prev, { role: 'model', content: result.response as string }]);

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setChatHistory(prev => [...prev, { role: 'model', content: `오류: ${errorMessage}` }]);
    } finally {
        setIsTutorLoading(false);
    }
  };
  
  if (!currentQuestion) {
     return (
        <div className="max-w-6xl mx-auto px-4">
            <div className="mb-4">
                 <Skeleton className="h-8 w-32" />
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <div>
                    <Skeleton className="h-[500px] w-full" />
                </div>
                <div>
                    <Skeleton className="h-[300px] w-full" />
                </div>
            </div>
      </div>
    );
  }


  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="mb-4">
        <Button asChild variant="ghost" className="pl-1">
          <Link href="/questions">
            <ChevronLeft className="h-4 w-4 mr-2" />
            문제 은행으로 돌아가기
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <QuestionDisplay
          question={currentQuestion}
          isSubmitted={isSubmitted}
          onAnswerSubmit={handleAnswerSubmit}
          key={currentQuestion.id}
        />
        <AiMentor
          isSubmitted={isSubmitted}
          isCorrect={isCorrect}
          error={error}
          chatHistory={chatHistory}
          isTutorLoading={isTutorLoading}
          onReasonSubmit={handleReasonSubmit}
          onTutorSubmit={handleTutorSubmit}
          onGenerateSimilar={handleGenerateSimilar}
          mentorInteraction={mentorInteraction}
          setMentorInteraction={setMentorInteraction}
          generatedQuestionId={generatedQuestionId}
          onNavigateToGenerated={() => {
            if(generatedQuestionId) router.push(`/questions/${generatedQuestionId}`);
          }}
          selectedOptionText={
            selectedOptionId ? currentQuestion.options.find(opt => opt.id === selectedOptionId)?.text : undefined
          }
          correctOptionText={
            currentQuestion.options.find(opt => opt.id === currentQuestion.correctOptionId)?.text
          }
          questionText={currentQuestion.questionText}
        />
      </div>
    </div>
  );
}
