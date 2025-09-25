"use client";

import { useState, useEffect } from 'react';
import QuestionDisplay from '@/components/question-display';
import { type Question } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

interface RandomQuizClientProps {
  allQuestions: Question[];
}

export default function RandomQuizClient({ allQuestions }: RandomQuizClientProps) {
  const [question, setQuestion] = useState<Question | null>(null);

  const selectRandomQuestion = () => {
    const randomQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    setQuestion(randomQuestion);
  };

  // Select a random question on the client side after the initial render
  useEffect(() => {
    selectRandomQuestion();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allQuestions]);

  if (!question) {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div>
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">랜덤 문제 풀이</h1>
                <p className="text-muted-foreground mt-2">
                자신의 지식을 테스트해보세요! 시스템이 무작위로 문제를 선택합니다.
                </p>
            </div>
            <Button onClick={selectRandomQuestion}>
                <RefreshCw className="mr-2 h-4 w-4" />
                다른 문제 풀기
            </Button>
        </div>
      </div>
      <QuestionDisplay question={question} />
    </div>
  );
}
