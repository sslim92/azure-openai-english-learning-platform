
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuestionCard } from '@/components/question-card';
import { type Question } from '@/lib/data';
import { Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface SearchSectionProps {
  allQuestions: Question[];
  availableYears: number[];
}

export default function SearchSection({ allQuestions, availableYears }: SearchSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [showAiOnly, setShowAiOnly] = useState(false);

  useEffect(() => {
    const monthsForYear = [...new Set(allQuestions.filter(q => selectedYear === 'all' || q.year === parseInt(selectedYear)).map(q => q.month).filter(m => m !== undefined) as number[])].sort((a,b) => b-a);
    setAvailableMonths(monthsForYear);
    setSelectedMonth('all'); // Reset month when year changes
  }, [selectedYear, allQuestions]);


  const filteredQuestions = useMemo(() => {
    return allQuestions.filter(question => {
      if (showAiOnly && !question.id.startsWith('ai-generated-')) {
          return false;
      }
      
      const fullText = `${question.questionText} ${question.passage || ''}`.toLowerCase();
      const queryMatch = searchQuery === '' || fullText.includes(searchQuery.toLowerCase()) || question.intent.toLowerCase().includes(searchQuery.toLowerCase());
      const yearMatch = selectedYear === 'all' || question.year === parseInt(selectedYear);
      const monthMatch = selectedMonth === 'all' || question.month === parseInt(selectedMonth);

      if (showAiOnly) {
        return question.id.startsWith('ai-generated-') && queryMatch;
      }

      return queryMatch && yearMatch && monthMatch;
    });
  }, [allQuestions, searchQuery, selectedYear, selectedMonth, showAiOnly]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="키워드나 출제 의도 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    disabled={showAiOnly}
                />
            </div>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear} disabled={showAiOnly}>
          <SelectTrigger>
            <SelectValue placeholder="연도 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 연도</SelectItem>
            {availableYears.map(year => (
              <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={showAiOnly || availableMonths.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="월 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 월</SelectItem>
            {availableMonths.map((month, index) => (
              <SelectItem key={`${month}-${index}`} value={String(month)}>{month}월</SelectItem>
            ))}
          </SelectContent>
        </Select>
         <div className="flex items-center justify-end space-x-2">
            <Checkbox id="ai-only" checked={showAiOnly} onCheckedChange={(checked) => setShowAiOnly(Boolean(checked))} />
            <Label htmlFor="ai-only" className="text-sm font-medium leading-none cursor-pointer">
                AI 생성 문제만 보기
            </Label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map(question => (
            <QuestionCard key={question.id} question={question} />
          ))
        ) : (
          <p className="md:col-span-3 text-center text-muted-foreground">검색 조건에 맞는 문제가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
