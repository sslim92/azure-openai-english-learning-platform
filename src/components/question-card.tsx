
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type Question } from '@/lib/data';
import { Sparkles } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
}

export function QuestionCard({ question }: QuestionCardProps) {
  const getSubjectBadgeVariant = (subject: Question['subject']) => {
    switch (subject) {
      case 'English':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  }
  
  const isAiGenerated = question.id.startsWith('ai-generated-');

  return (
    <Link href={`/questions/${question.id}`} className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
      <Card className="flex flex-col h-full">
        <CardHeader>
          <div className="flex justify-between items-start mb-2 gap-2">
            <div>
                <Badge variant="outline" className={getSubjectBadgeVariant(question.subject)}>{question.subject}</Badge>
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
          <CardTitle className="text-lg font-headline">{question.topic}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {question.questionText}
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
