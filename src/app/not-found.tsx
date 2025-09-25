import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center h-[calc(100dvh-200px)]">
      <FileSearch className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-6xl font-bold font-headline text-primary">404</h1>
      <h2 className="text-2xl font-semibold mt-4">페이지를 찾을 수 없습니다</h2>
      <p className="text-muted-foreground mt-2 max-w-md">죄송합니다, 찾으시는 페이지를 발견할 수 없었습니다. 페이지가 이동되었거나 삭제되었을 수 있습니다.</p>
      <Button asChild className="mt-6">
        <Link href="/">문제 은행으로 돌아가기</Link>
      </Button>
    </div>
  )
}
