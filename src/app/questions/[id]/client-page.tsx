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
import { getTutorResponse, processUserMistake, createSimilarQuestion, generateCustomExplanation } from '@/lib/actions';
import type { ChatMessage } from '@/components/ai-mentor';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

interface QuestionClientPageProps {
    initialQuestion: Question;
}

// Defines the possible interaction modes with the AI mentor
type MentorInteraction = 'idle' | 'analyzing' | 'tutoring' | 'generating' | 'generationComplete';

export default function QuestionClientPage({ initialQuestion }: QuestionClientPageProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question>(initialQuestion);
  
  const [mentorInteraction, setMentorInteraction] = useState<MentorInteraction>('idle');
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuestionId, setGeneratedQuestionId] = useState<string | null>(null);

  // State for conversational tutor
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();


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
    setAnalysis(null);
    setError(null);
    setChatHistory([]);
    setMentorInteraction('idle');
    setGeneratedQuestionId(null);
  };

  const handleWrongAnswer = async (selectedOptionId: string) => {
    try {
      const selectedOption = currentQuestion.options.find(o => o.id === selectedOptionId);
      const correctOption = currentQuestion.options.find(o => o.id === currentQuestion.correctOptionId);
      
      if (!selectedOption || !correctOption) {
        throw new Error('선택지를 찾을 수 없습니다.');
      }

      const result = await generateCustomExplanation({
        questionText: currentQuestion.questionText,
        passage: currentQuestion.passage,
        options: currentQuestion.options,
        correctOptionId: currentQuestion.correctOptionId,
        selectedOptionId,
        originalExplanation: currentQuestion.explanation
      });

      if (result.success && result.explanation) {
        return `아쉽지만 정답을 살짝 비껴갔네요. 정답은 '${correctOption.text}'입니다.\n\n${result.explanation}\n\n괜찮습니다. 메기도 가끔 물길을 헤매다 길을 찾곤 하죠. 해설을 보고 궁금한 점을 질문하시거나, AI 약점 분석을 받아보세요.`;
      } else {
        // Fallback to original explanation
        return `아쉽지만 정답을 살짝 비껴갔네요. 정답은 '${correctOption.text}'입니다.\n\n해설: ${currentQuestion.explanation}\n\n괜찮습니다. 메기도 가끔 물길을 헤매다 길을 찾곤 하죠. 해설을 보고 궁금한 점을 질문하시거나, AI 약점 분석을 받아보세요.`;
      }
    } catch (error) {
      console.error('AI 설명 생성 중 오류:', error);
      // Fallback to original explanation
      const correctOption = currentQuestion.options.find(o => o.id === currentQuestion.correctOptionId);
      return `아쉽지만 정답을 살짝 비껴갔네요. 정답은 '${correctOption?.text}'입니다.\n\n해설: ${currentQuestion.explanation}\n\n괜찮습니다. 메기도 가끔 물길을 헤매다 길을 찾곤 하죠. 해설을 보고 궁금한 점을 질문하시거나, AI 약점 분석을 받아보세요.`;
    }
  };

  const handleAnswerSubmit = async (selectedOptionId: string) => {
    setIsSubmitted(true);
    setError(null);
    setAnalysis(null);
    setChatHistory([]);
    setGeneratedQuestionId(null);

    const correct = selectedOptionId === currentQuestion.correctOptionId;
    setIsCorrect(correct);
    setMentorInteraction('tutoring'); // Default to tutoring mode after any submission
    
    if (correct) {
      setChatHistory([{ role: 'model', content: '훌륭해요, 이번 물살은 잘 타셨네요! 개념을 확실히 다지기 위해 AI가 만든 유사 문제를 풀어보시겠어요? 또는 궁금한 점이 있다면 질문해주세요.' }]);
    } else {
      // Generate AI-powered custom explanation for wrong answers
      const customMessage = await handleWrongAnswer(selectedOptionId);
      setChatHistory([{ role: 'model', content: customMessage }]);
    }
  };

  const handleReasonSubmit = async (userReason: string) => {
     if (!user) {
        toast({
            variant: "destructive",
            title: "로그인 필요",
            description: "약점 분석 기능을 사용하려면 로그인이 필요합니다.",
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
    
    setChatHistory(prev => [...prev, {role: 'user', content: `제가 이 답을 고른 이유는... ${userReason}`}]);

    try {
        const questionContext = `문제: ${currentQuestion.questionText}\n본문: ${currentQuestion.passage}\n선택지: ${currentQuestion.options.map(o => `${o.id}: ${o.text}`).join('\n')}\n정답: ${currentQuestion.correctOptionId}`;
        const result = await processUserMistake({
            userId: user.uid, // This needs to be the UserId from your Users table
            questionId: currentQuestion.id,
            questionContext: questionContext,
            selectedOptionId: selectedOption.id,
            selectedOptionText: selectedOption.text,
            userReason: userReason
        });

        if (!result.success) {
            throw new Error(result.error || 'AI 분석에 실패했습니다.');
        }

        const newAnalysis = result.analysis;
        
        // Store analysis for tutor's use
        setAnalysis(result.analysis); // Store original analysis for tutor chat
        setChatHistory(prev => [...prev, {role: 'model', content: newAnalysis}]);
        if (result.newQuestion) {
          setGeneratedQuestionId(result.newQuestion.id);
        }
        
        toast({
            title: "✅ 맞춤 문제 도착!",
            description: "AI 메기 멘토가 새로운 성장의 기회를 만들었습니다.",
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
    
    if (!user) {
        toast({
            variant: "destructive",
            title: "로그인 필요",
            description: "문제 생성 기능을 사용하려면 로그인이 필요합니다.",
        });
        router.push('/login');
        return;
    }

    try {
        const result = await createSimilarQuestion(currentQuestion);

        if (!result.success) {
            throw new Error(result.error || '유사 문제 생성에 실패했습니다.');
        }

        if (result.newQuestion) {
          setGeneratedQuestionId(result.newQuestion.id);
        }

        toast({
            title: "🎯 새로운 문제 생성 완료!",
            description: "개념을 한 번 더 확인해보세요!",
        });

        const response = `개념을 다질 수 있는 새로운 문제를 준비했어요! 풀어보실래요?`;
        setChatHistory(prev => [...prev, { role: 'model', content: response }]);
        
        setMentorInteraction('generationComplete');

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMessage);
        setChatHistory(prev => [...prev, { role: 'model', content: `문제 생성 중 오류가 발생했습니다: ${errorMessage}` }]);
        setMentorInteraction('tutoring'); // Allow chatting even on error
    }
  };

  const handleTutorSubmit = async (message: string) => {
    if (!message.trim()) return;

    setIsTutorLoading(true);
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: message }];
    setChatHistory(newHistory);

    try {
        const questionContext = `
        문제: ${currentQuestion.questionText}
        본문: ${currentQuestion.passage}
        선택지: ${currentQuestion.options.map(o => `${o.id}: ${o.text}`).join('\n')}
        정답: ${currentQuestion.correctOptionId}
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
        />
      </div>
    </div>
  );
}