
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getQuestions } from '@/lib/data';
import type { Question } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuestionCard } from '@/components/question-card';
import { ArrowRight, BookOpen, Shuffle, Mic, BarChart3, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const [recentQuestions, setRecentQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuestions() {
      try {
        const allQuestions = await getQuestions();
        setRecentQuestions(allQuestions.slice(0, 3));
      } catch (error) {
        console.error("Failed to fetch questions for dashboard", error);
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, []);

  const features = [
    {
      title: '문제 은행 탐험하기',
      description: '다양한 기출 문제의 물살을 타보세요.',
      href: '/questions',
      icon: BookOpen,
    },
    {
      title: '랜덤 문제로 실력 점검',
      description: '예상치 못한 문제로 실력을 확인해 보세요.',
      href: '/random-quiz',
      icon: Shuffle,
    },
    {
      title: 'AI 듣기 평가 훈련',
      description: 'AI가 만든 음성으로 듣기 능력을 단련하세요.',
      href: '/listening-quiz',
      icon: Mic,
    },
     {
      title: '나의 학습 흐름 분석',
      description: '학습 기록을 돌아보며 성장의 흐름을 파악하세요.',
      href: '/progress',
      icon: BarChart3,
    },
  ];

  if (loading) {
     return (
        <div className="space-y-12">
            <div className="text-center bg-card border rounded-lg p-8">
                <Skeleton className="h-10 w-3/4 mx-auto mb-4" />
                <Skeleton className="h-6 w-1/2 mx-auto" />
                <Skeleton className="h-10 w-48 mx-auto mt-6" />
            </div>
             <section>
                <Skeleton className="h-8 w-48 mb-6" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-40 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                </div>
            </section>
             <section>
                <div className="flex justify-between items-center mb-6">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-64 rounded-lg" />
                    <Skeleton className="h-64 rounded-lg" />
                    <Skeleton className="h-64 rounded-lg" />
                </div>
            </section>
        </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="text-center bg-card border rounded-lg p-8">
        <h1 className="text-4xl font-bold tracking-tight font-headline">돌아오셨군요! 학습의 물살을 타볼까요?</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
          AI 메기 멘토가 여러분의 학습 여정을 안내합니다.
          약점을 진단하고, 맞춤 피드백으로 성장의 흐름을 만들어 보세요.
        </p>
        <Button asChild className="mt-6">
          <Link href="/random-quiz">
            랜덤 문제로 몸풀기 <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <section>
        <h2 className="text-2xl font-bold font-headline mb-6">학습 탐험하기</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href} className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
                <Card className="h-full flex flex-col items-start p-6">
                    <div className="bg-primary/10 p-3 rounded-full mb-4">
                        <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold font-headline">{feature.title}</h3>
                    <p className="text-muted-foreground mt-1 flex-grow">{feature.description}</p>
                     <Button variant="link" className="p-0 mt-4 h-auto">
                        바로가기 <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </Card>
            </Link>
          ))}
        </div>
      </section>
      
      <section>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold font-headline">최근 추가된 문제</h2>
            <Button asChild variant="outline">
                <Link href="/questions">
                    전체 보기
                </Link>
            </Button>
        </div>
        {recentQuestions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentQuestions.map((question) => (
              <QuestionCard key={question.id} question={question} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              최근 추가된 문제가 없습니다.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
