
"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BarChart, Users, Target, BookOpenCheck } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, BarChart as RechartsBarChart } from "recharts";

const chartData = [
  { topic: "어휘", correct: 4, incorrect: 2 },
  { topic: "문법", correct: 7, incorrect: 1 },
  { topic: "독해", correct: 5, incorrect: 5 },
  { topic: "숙어", correct: 2, incorrect: 3 },
];

const chartConfig = {
  correct: {
    label: "정답",
    color: "hsl(var(--chart-2))",
  },
  incorrect: {
    label: "오답",
    color: "hsl(var(--chart-1))",
  },
};

export default function ProgressPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">나의 학습 현황</h1>
        <p className="text-muted-foreground mt-2">
          결과를 검토하고, 약점을 분석하고, 추천을 받으세요.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">총 푼 문제 수</CardTitle>
            <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-muted-foreground">지난주보다 15개 증가</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">전체 정확도</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78.1%</div>
            <p className="text-xs text-muted-foreground">지난달보다 2.5% 상승</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">동료 비교 (백분위)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">상위 20%</div>
            <p className="text-xs text-muted-foreground">다른 모든 사용자와 비교</p>
          </CardContent>
        </Card>
      </div>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>주제별 성과</CardTitle>
          <CardDescription>
            각 주제별 정답 및 오답 분석입니다.
            <br />
            <span className="text-xs text-muted-foreground italic">(참고: 이 데이터는 예시입니다. 실제 학습 현황은 여기에 표시됩니다.)</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
             <RechartsBarChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <YAxis />
                <XAxis
                  dataKey="topic"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Bar dataKey="correct" fill="var(--color-correct)" radius={4} />
                <Bar dataKey="incorrect" fill="var(--color-incorrect)" radius={4} />
              </RechartsBarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
