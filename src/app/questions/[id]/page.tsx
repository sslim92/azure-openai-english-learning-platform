import { fetchQuestionById } from '@/lib/actions';
import { notFound } from 'next/navigation';
import QuestionClientPage from './client-page';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function QuestionLoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
              <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
                <Skeleton className="h-[600px] w-full" />
            </div>
            <div>
                <Skeleton className="h-[400px] w-full" />
            </div>
        </div>
    </div>
  );
}

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const question = await fetchQuestionById(resolvedParams.id);

  if (!question) {
    notFound();
  }

  return (
    <Suspense fallback={<QuestionLoadingSkeleton />}>
      <QuestionClientPage initialQuestion={question} />
    </Suspense>
  );
}
