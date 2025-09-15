
import SearchSection from '@/components/search-section';
import { getQuestions, getAvailableYears } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function QuestionsPage() {
  const allQuestions = await getQuestions();
  const availableYears = await getAvailableYears();
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">영어 문제 은행</h1>
        <p className="text-muted-foreground mt-2">
          수능 아카이브에서 영어 문제를 검색하고 필터링하세요.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>검색 및 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchSection allQuestions={allQuestions} availableYears={availableYears} />
        </CardContent>
      </Card>
    </div>
  );
}
