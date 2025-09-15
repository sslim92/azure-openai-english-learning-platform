
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Bot, PenSquare, BrainCircuit } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  const features = [
    {
      icon: <PenSquare className="h-8 w-8 text-primary" />,
      title: '실전 감각, 기출 문제 풀이',
      description: '실제 수능, 모의고사 기출 문제의 물살을 타며 실전 감각을 키워보세요.',
    },
    {
      icon: <Bot className="h-8 w-8 text-primary" />,
      title: 'AI 메기 멘토의 약점 분석',
      description: '정답 너머의 진짜 약점을 AI 메기 멘토가 수염으로 날카롭게 찾아내 드려요.',
    },
    {
      icon: <BrainCircuit className="h-8 w-8 text-primary" />,
      title: '성장을 위한 맞춤형 학습',
      description: 'AI 튜터와 대화하며 약점을 보완할 맞춤 문제를 받고, 더 큰 물에서 헤엄쳐보세요.',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <main className="flex-1">
        <section className="relative w-full pt-12 md:pt-24 lg:pt-32">
           <div className="absolute inset-0 -z-10">
              <Image
                src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2084&auto=format&fit=crop"
                alt="Background"
                fill
                className="object-cover opacity-5"
                data-ai-hint="team working"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
           </div>

          <div className="container px-4 md:px-6 text-center">
            <div className="flex flex-col items-center space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl font-headline animate-fade-in-up">
                AI 메기와 함께 잠재력을 깨우세요
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl animate-fade-in-up animation-delay-200">
                AI 메기 멘토와 함께 수능 영어의 흐름을 바꾸세요. 약점을 분석하고, 맞춤형 피드백으로 더 큰 성장의 물살을 타보세요.
              </p>
              <div className="space-x-4 mt-6 animate-fade-in-up animation-delay-400">
                <Button asChild size="lg">
                  <Link href="/questions">
                    학습 탐험 시작하기 <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">메기스터디 핵심 기능</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">더 똑똑하게, 메기처럼</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  메기스터디의 혁신적인 기능으로 성장의 물살을 경험하세요.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:grid-cols-3 lg:gap-12 mt-12">
              {features.map((feature, index) => (
                <Card key={index} className="p-6 text-center flex flex-col items-center hover:shadow-lg transition-shadow duration-300 transform hover:-translate-y-1">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold font-headline">{feature.title}</h3>
                  <p className="text-muted-foreground mt-2">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight font-headline">
                점수를 바꿀 물살을 탈 준비, 되셨나요?
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                오늘 바로 시작하세요. AI 메기 멘토가 여러분의 성장을 이끌어 드립니다.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-x-2">
               <Button asChild size="lg">
                  <Link href="/questions">
                    문제 은행으로 가기
                  </Link>
                </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; 2024 메기스터디. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            이용약관
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            개인정보처리방침
          </Link>
        </nav>
      </footer>
    </div>
  );
}
