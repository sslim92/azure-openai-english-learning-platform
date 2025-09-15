
"use client";

import { useState } from 'react';
import { type Question } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { textToSpeech } from '@/lib/actions';
import { Loader2, PlayCircle, Volume2, Info, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface QuestionDisplayProps {
  question: Question;
  isSubmitted?: boolean;
  onAnswerSubmit?: (selectedOption: string) => void;
}

export default function QuestionDisplay({ 
  question, 
  isSubmitted = false,
  onAnswerSubmit,
}: QuestionDisplayProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const { toast } = useToast();

  const handleGenerateAudio = async () => {
    if (!question.listeningScript) return;
    setIsGeneratingAudio(true);
    try {
      const result = await textToSpeech(question.listeningScript);
      if (result.success && result.data) {
        setAudioDataUri(result.data.audioDataUri);
      } else {
        throw new Error(result.error || '음성 생성에 실패했습니다.');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err instanceof Error ? err.message : '알 수 없는 오디오 생성 오류',
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption || !onAnswerSubmit) return;
    onAnswerSubmit(selectedOption);
  };
  
  const isAiGenerated = question.id.startsWith('ai-generated-');

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="font-headline text-2xl">{question.subject}: {question.topic}</CardTitle>
            {isAiGenerated && (
                 <div className="text-sm inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                    <Sparkles className="mr-1.5 h-4 w-4" /> AI 맞춤 문제
                </div>
            )}
        </div>
        <CardDescription>
            {question.year && question.month ? `${question.year}년 ${question.month}월 - ` : ''}
            {question.difficulty} 난이도
        </CardDescription>
      </CardHeader>
      <CardContent>
        {question.generationReason && (
            <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-300">AI 맞춤형 문제입니다</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-400">
                    {question.generationReason}
                </AlertDescription>
            </Alert>
        )}

        {question.listeningScript && (
          <div className="mb-6 p-4 border rounded-md bg-secondary/50">
            <h4 className="font-semibold mb-3 flex items-center"><Volume2 className="mr-2 h-5 w-5"/> 듣기 평가 지문</h4>
            {audioDataUri ? (
              <audio controls className="w-full" src={audioDataUri}>
                브라우저가 오디오 요소를 지원하지 않습니다.
              </audio>
            ) : (
              <Button onClick={handleGenerateAudio} disabled={isGeneratingAudio}>
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    음성 생성 중...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    듣기 재생
                  </>
                )}
              </Button>
            )}
          </div>
        )}
        
        {question.imageDescription && (
          <div className="mb-6 p-4 border rounded-md bg-secondary/50">
              <h4 className="font-semibold mb-3 flex items-center"><Info className="mr-2 h-5 w-5" /> 참고 자료</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{question.imageDescription}</p>
          </div>
         )}

        <p className="text-lg mb-6 whitespace-pre-wrap">{question.questionText}</p>
        <form onSubmit={handleSubmit}>
          <RadioGroup name="question-options" value={selectedOption ?? ""} onValueChange={setSelectedOption} disabled={isSubmitted}>
            {question.options.map(option => (
              <div key={option.id} className="flex items-center space-x-2 my-2 p-3 rounded-md border border-transparent transition-all has-[:checked]:border-primary has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/20">
                <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                <Label htmlFor={`option-${option.id}`} className="flex-1 cursor-pointer">{option.text}</Label>
              </div>
            ))}
          </RadioGroup>
          {onAnswerSubmit && !isSubmitted && (
            <div className="mt-6">
              <Button type="submit" disabled={!selectedOption}>
                답안 제출
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
