'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, LogIn } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // useEffect(() => {
  //   // If user is logged in, redirect them to the main dashboard
  //   if (!loading && user) {
  //     router.push('/');
  //   }
  // }, [user, loading, router]);


  const renderButtons = () => {
    if (loading) {
      return <Skeleton className="h-12 w-48" />;
    }
    // If user is not logged in, show login/signup buttons
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
        <Button asChild size="lg">
          <Link href="/questions">
            문제 은행 둘러보기 <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">
            로그인 / 회원가입 <LogIn className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background text-center p-4">
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-[350px] h-[350px] mb-6">
            <Image
                src="/images/logo.png"
                alt="메기스터디 로고"
                fill
                priority
                className="object-contain"
            />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-headline animate-fade-in-up">
          성장의 물살을 타볼까요?
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground animate-fade-in-up animation-delay-200">
          AI 메기 멘토와 함께 수능 영어의 흐름을 익히고, 약점을 극복하며, 자신감을 키워보세요.
        </p>
        {renderButtons()}
      </main>
    </div>
  );
}
