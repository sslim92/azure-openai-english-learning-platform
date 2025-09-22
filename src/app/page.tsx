
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { BookOpen, RefreshCw, Target, BookOpenCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const XP_PER_LEVEL = 30; // From data.ts logic

  useEffect(() => {
    // If not loading and no user, redirect to the landing page.
    if (!loading && !user) {
      router.push('/landing');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    // Show a skeleton loader while auth state is being determined
    return (
      <div className="space-y-8">
        <div>
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-5 w-1/2" />
        </div>
        <div className="grid lg:grid-cols-2 gap-8 items-start">
            <Skeleton className="h-[400px] w-full" />
            <div className="space-y-8">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[150px] w-full" />
            </div>
        </div>
      </div>
    );
  }

  const progressPercentage = user.experiencePoints !== undefined ? Math.min((user.experiencePoints / XP_PER_LEVEL) * 100, 100) : 0;
  const remainingXp = user.experiencePoints !== undefined ? XP_PER_LEVEL - user.experiencePoints : XP_PER_LEVEL;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {user.displayName || user.email}님, 돌아오셨군요!
        </h1>
        <p className="text-muted-foreground mt-2">
          오늘도 메기와 함께 성장의 물살을 타볼까요?
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Catfish Info */}
        <Card className="bg-gradient-to-br from-primary/10 to-background dark:from-primary/20 dark:to-background border-primary/20 shadow-lg h-full">
            <CardHeader>
                <CardTitle>나의 메기</CardTitle>
                <CardDescription>문제를 풀고 경험치를 얻어 메기를 성장시켜보세요!</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center pt-8">
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0 mb-6">
                    <Image
                        src={`/images/catfish/${user.stage || '알'}.png`}
                        alt={user.stage || '알'}
                        fill
                        priority
                        className="object-contain"
                    />
                </div>
                <div className="space-y-3 w-full max-w-sm">
                    <div className="space-y-1">
                        <p className="font-bold text-3xl text-primary font-headline">{user.stage || '알'}</p>
                        <p className="text-lg text-muted-foreground">Lv. {user.level || 1}</p>
                    </div>
                    <div>
                        <div className="flex justify-between font-mono text-sm px-1 pt-2">
                            <span>경험치 (XP)</span>
                            <span>{user.experiencePoints || 0} / {XP_PER_LEVEL}</span>
                        </div>
                        <Progress value={progressPercentage} className="h-3" />
                        <p className="text-xs text-muted-foreground text-right px-1 mt-1">
                            다음 레벨까지 {remainingXp < 0 ? 0 : remainingXp} XP
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Right Column: Stats and Actions */}
        <div className="space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle>학습 통계</CardTitle>
                    <CardDescription>나의 학습 현황을 한눈에 확인하세요.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/50">
                        <BookOpenCheck className="h-8 w-8 text-primary mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">총 푼 문제</p>
                        <p className="text-3xl font-bold">{user.totalQuestionsSolved || 0}</p>
                    </div>
                    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/50">
                        <Target className="h-8 w-8 text-primary mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">정확도</p>
                        <p className="text-3xl font-bold">{user.accuracy || 0}%</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>학습 시작하기</CardTitle>
                    <CardDescription>다양한 방법으로 학습을 시작하고 메기를 성장시켜보세요.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <Button asChild size="lg" className="flex-1">
                        <Link href="/random-quiz">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            랜덤 문제로 실력 점검
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="flex-1">
                        <Link href="/questions">
                            <BookOpen className="mr-2 h-4 w-4" />
                            문제 은행에서 직접 선택
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>

    </div>
  );
}
