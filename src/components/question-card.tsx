
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type Question } from '@/lib/data';
import { Sparkles } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
}

export function QuestionCard({ question }: QuestionCardProps) {
  
  const isAiGenerated = question.id.startsWith('ai');
  const fullQuestionText = `${question.questionText}\n\n${question.passage || ''}`;

  return (
    <Link href={`/questions/${question.id}`} className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
      <Card className="flex flex-col h-full">
        <CardHeader>
          <div className="flex justify-between items-start mb-2 gap-2">
            <div>
                <Badge variant="outline" className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'>English</Badge>
            </div>
            {isAiGenerated ? (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 whitespace-nowrap">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI 생성
                </Badge>
              ) : (
                 question.year && question.month && <Badge variant="secondary">{question.year}년 {question.month}월</Badge>
              )
            }
          </div>
          <CardTitle className="text-lg font-headline">{question.intent}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {fullQuestionText}
          </p>
        </CardContent>
        <CardFooter>
          <Badge variant={question.difficulty === 'Easy' ? 'default' : question.difficulty === 'Medium' ? 'secondary' : 'destructive'} className="capitalize bg-opacity-20 border-none">
            {question.difficulty}
          </Badge>
        </CardFooter>
      </Card>
    </Link>
  );
}
