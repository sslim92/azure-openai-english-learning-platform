"use client";

import { useState, useEffect } from 'react';
import QuestionDisplay from '@/components/question-display';
import { type Question } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface RandomQuizClientProps {
  allQuestions: Question[];
}

export default function RandomQuizClient({ allQuestions }: RandomQuizClientProps) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const selectRandomQuestion = () => {
    const randomQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    setQuestion(randomQuestion);
    setIsSubmitted(false);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const handleAnswerSubmit = (selectedOption: string) => {
    setSelectedAnswer(selectedOption);
    setIsSubmitted(true);
    setShowResult(true);
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

  const isCorrect = selectedAnswer === question.correctOptionId;

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
      
      <QuestionDisplay 
        question={question} 
        isSubmitted={isSubmitted}
        onAnswerSubmit={handleAnswerSubmit}
      />
      
      {showResult && (
        <Card className={`border-2 ${isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              {isCorrect ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <h3 className={`text-xl font-semibold ${isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {isCorrect ? '정답입니다!' : '틀렸습니다.'}
              </h3>
            </div>
            
            {!isCorrect && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">정답:</p>
                <p className="font-medium">
                  {question.options.find(opt => opt.id === question.correctOptionId)?.text}
                </p>
              </div>
            )}
            
            {question.explanation && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">해설:</p>
                <p className="text-sm whitespace-pre-wrap">{question.explanation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
