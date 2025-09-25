import { getQuestions } from '@/lib/data';
import RandomQuizClient from './random-quiz-client';

export const dynamic = 'force-dynamic';

export default async function RandomQuizPage() {
  const allQuestions = await getQuestions();
  
  if (allQuestions.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center h-[calc(100dvh-200px)]">
            <h1 className="text-2xl font-semibold mt-4">문제가 없습니다</h1>
            <p className="text-muted-foreground mt-2 max-w-md">문제 은행에 문제가 없습니다. 관리자에서 문제를 추가한 뒤 다시 시도해주세요.</p>
        </div>
    )
  }
  
  // Math.random() is removed from here to prevent hydration errors.
  // The client will now be responsible for picking a random question.
  return <RandomQuizClient allQuestions={allQuestions} />;
}
