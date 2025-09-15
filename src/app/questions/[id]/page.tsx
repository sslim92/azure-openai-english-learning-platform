import { getQuestionById } from '@/lib/data';
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


export default function QuestionPage({ params }: { params: { id: string } }) {
  
  const Page = async () => {
    const question = await getQuestionById(params.id);

    if (!question) {
      notFound();
    }

    return <QuestionClientPage initialQuestion={question} />;
  }

  return (
    <Suspense fallback={<QuestionLoadingSkeleton />}>
      <Page />
    </Suspense>
  );
  
}
