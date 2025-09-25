
'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, CheckCircle, Sparkles, XCircle, Loader2, User, Send, ArrowRight, TestTube2, BrainCircuit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"


export type ChatMessage = {
    role: 'user' | 'model';
    content: string;
};

export type MentorInteraction = 'idle' | 'analyzing' | 'tutoring' | 'generating' | 'generationComplete';

interface AiMentorProps {
  isSubmitted: boolean;
  isCorrect: boolean | null;
  error: string | null;
  chatHistory: ChatMessage[];
  isTutorLoading: boolean;
  onReasonSubmit: (reason: string) => void;
  onGenerateSimilar: () => void;
  onTutorSubmit: (input: string) => void;
  mentorInteraction: MentorInteraction;
  setMentorInteraction: (interaction: MentorInteraction) => void;
  generatedQuestionId: string | null;
  onNavigateToGenerated: () => void;
  selectedOptionText?: string;
  correctOptionText?: string;
  questionText?: string;
}

function ReasonDialog({ 
    onReasonSubmit, 
    chatHistory, 
    selectedOptionText, 
    correctOptionText, 
    questionText 
}: { 
    onReasonSubmit: (reason: string) => void;
    chatHistory: ChatMessage[];
    selectedOptionText?: string;
    correctOptionText?: string;
    questionText?: string;
}) {
    const [reason, setReason] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);

    const handleAutoExtract = async () => {
        if (!chatHistory.length || !selectedOptionText || !correctOptionText || !questionText) {
            return;
        }

        setIsExtracting(true);
        try {
            const { extractMistakeReasonFromChat } = await import('@/lib/actions');
            const result = await extractMistakeReasonFromChat({
                chatHistory,
                selectedOptionText,
                correctOptionText,
                questionText
            });
            
            if (result.success && result.extractedReason) {
                setReason(result.extractedReason);
            }
        } catch (error) {
            console.error('오답 이유 자동 추출 실패:', error);
            // 실패해도 사용자가 직접 입력할 수 있게 에러 처리는 조용히
        } finally {
            setIsExtracting(false);
        }
    };

    // 다이얼로그가 열릴 때 자동으로 추출 시도
    useEffect(() => {
        if (chatHistory.length > 0 && selectedOptionText && correctOptionText && questionText) {
            handleAutoExtract();
        }
    }, [chatHistory, selectedOptionText, correctOptionText, questionText]);

    const handleSubmit = () => {
        if (reason.trim()) {
            onReasonSubmit(reason);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>AI 메기 멘토의 약점 분석</DialogTitle>
                <DialogDescription>
                    대화 내역을 분석해서 오답 이유를 추출했어요. 내용을 확인하고 수정하거나 직접 작성해주세요.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
                {isExtracting && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        대화 내역에서 오답 이유를 분석 중...
                    </div>
                )}
                <Textarea
                    placeholder="예: 지문의 특정 단어를 잘못 해석했어요, 문법 구조가 헷갈렸어요, 선택지들이 너무 비슷해 보였어요 등"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    disabled={isExtracting}
                />
                {chatHistory.length > 0 && !isExtracting && (
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={handleAutoExtract}
                        className="self-start"
                    >
                        <BrainCircuit className="h-4 w-4 mr-2" />
                        대화에서 다시 분석하기
                    </Button>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">취소</Button>
                </DialogClose>
                <DialogClose asChild>
                    <Button onClick={handleSubmit} disabled={!reason.trim()}>분석 및 문제 생성 요청</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}

export default function AiMentor({
  isSubmitted,
  isCorrect,
  error,
  chatHistory,
  isTutorLoading,
  onReasonSubmit,
  onGenerateSimilar,
  onTutorSubmit,
  mentorInteraction,
  setMentorInteraction,
  generatedQuestionId,
  onNavigateToGenerated,
  selectedOptionText,
  correctOptionText,
  questionText,
}: AiMentorProps) {
  const [tutorInput, setTutorInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Scroll to bottom when new message is added
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tutorInput.trim()) {
        onTutorSubmit(tutorInput);
        setTutorInput('');
    }
  }
  
  const WelcomeMessage = () => (
    <div className="flex items-start space-x-4 rounded-lg bg-background p-4">
        <div className="flex-shrink-0">
            <Bot className="h-8 w-8 text-primary" />
        </div>
        <div>
            <p className="font-semibold">안녕하세요! 여러분의 학습 파트너, AI 메기 멘토입니다.</p>
            <p className="text-sm text-muted-foreground">
                문제를 풀고 답안을 제출하면, 제가 나타나 성장의 물살을 탈 수 있도록 도와드릴게요.
            </p>
        </div>
    </div>
  );
  
  const renderContent = () => {
    if (!isSubmitted) return <WelcomeMessage />;

    if (mentorInteraction === 'analyzing' || mentorInteraction === 'generating') {
        const title = mentorInteraction === 'analyzing' ? 'AI 메기 멘토가 약점을 탐색 중입니다' : 'AI 메기 멘토가 새로운 물길을 내는 중입니다';
        const description = mentorInteraction === 'analyzing' ? '날카로운 수염으로 약점을 찾아 맞춤 문제를 만들고 있어요...' : '개념을 다질 수 있는 새로운 유사 문제를 생성하고 있어요...';
        return (
          <div className="flex flex-col items-center justify-center p-8 space-y-3 text-muted-foreground min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
            <p className="text-lg font-semibold">{title}</p>
            <p>{description}</p>
          </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {isCorrect !== null && (
                <Alert variant={isCorrect ? 'default' : 'destructive'} className={`${isCorrect ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' : ''}`}>
                    {isCorrect ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <AlertTitle>{isCorrect ? '정답을 낚으셨네요! 메기처럼 민첩해요!' : '조금 다른 물길로 가셨네요!'}</AlertTitle>
                </Alert>
            )}
            
            {error && <Alert variant="destructive" className="flex-shrink-0"><XCircle className="h-4 w-4" /><AlertTitle>오류 발생</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

            {chatHistory.length > 0 && (
                <div ref={chatContainerRef} className="space-y-4 rounded-lg border bg-muted/50 p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                    {chatHistory.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && <Bot className="h-6 w-6 text-primary flex-shrink-0" />}
                            <div className={`rounded-lg px-4 py-2 max-w-[85%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                             {msg.role === 'user' && <User className="h-6 w-6 text-muted-foreground flex-shrink-0" />}
                        </div>
                    ))}
                    {isTutorLoading && (
                         <div className="flex items-start gap-3">
                            <Bot className="h-6 w-6 text-primary flex-shrink-0" />
                            <div className="rounded-lg px-4 py-2 bg-background">
                                <Loader2 className="h-5 w-5 animate-spin text-primary"/>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
  }

  const renderFooter = () => {
      if (!isSubmitted || mentorInteraction === 'analyzing' || mentorInteraction === 'generating') return null;
      
      const incorrectAnswerButtons = !isCorrect && (
          <Dialog>
              <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                      <TestTube2 className="mr-2 h-4 w-4" />
                      AI 약점 분석 & 맞춤 문제
                  </Button>
              </DialogTrigger>
              <ReasonDialog 
                  onReasonSubmit={onReasonSubmit}
                  chatHistory={chatHistory}
                  selectedOptionText={selectedOptionText}
                  correctOptionText={correctOptionText}
                  questionText={questionText}
              />
          </Dialog>
      );

      const correctAnswerButtons = isCorrect && (
           <Button variant="outline" size="sm" onClick={onGenerateSimilar}>
              <BrainCircuit className="mr-2 h-4 w-4" />
              AI 유사 문제로 다음 물살 타기
            </Button>
      )
      
      const newQuestionButton = generatedQuestionId && (
           <Button onClick={onNavigateToGenerated} size="sm">
               <Sparkles className="mr-2 h-4 w-4" /> AI 추천 문제 풀어보기 <ArrowRight className="ml-2 h-4 w-4" />
           </Button>
      );

      return (
         <CardFooter className="pt-4 border-t flex flex-col items-start gap-4">
             {(mentorInteraction === 'tutoring' || mentorInteraction === 'generationComplete') && (
                <form onSubmit={handleFormSubmit} className="w-full flex items-center gap-2">
                    <Textarea 
                        value={tutorInput}
                        onChange={(e) => setTutorInput(e.target.value)}
                        placeholder="메기 멘토에게 질문하기..."
                        className="flex-1 resize-none"
                        rows={1}
                        disabled={isTutorLoading || mentorInteraction === 'analyzing' || mentorInteraction === 'generating'}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleFormSubmit(e);
                            }
                        }}
                    />
                    <Button type="submit" size="icon" disabled={!tutorInput.trim() || isTutorLoading || mentorInteraction === 'analyzing' || mentorInteraction === 'generating'}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
             )}
             
             <div className="flex items-center justify-end w-full">
                {generatedQuestionId ? newQuestionButton : (isCorrect ? correctAnswerButtons : incorrectAnswerButtons)}
             </div>
         </CardFooter>
      )
  }

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          <CardTitle className="font-headline text-2xl">AI 메기 멘토</CardTitle>
        </div>
        <CardDescription>학습의 흐름을 바꾸는 여러분의 파트너</CardDescription>
      </CardHeader>
      <CardContent className="min-h-[300px]">
        {renderContent()}
      </CardContent>
       {renderFooter()}
    </Card>
  );
}
