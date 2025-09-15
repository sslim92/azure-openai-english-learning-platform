
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileUp } from 'lucide-react';
import { uploadScriptsAndMatchToQuestions, getAvailableMonthsForYear } from '@/lib/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ScriptUploadFormProps {
    availableYears: number[];
}

export default function ScriptUploadForm({ availableYears }: ScriptUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMonths = async () => {
        if (selectedYear) {
            const months = await getAvailableMonthsForYear(parseInt(selectedYear));
            setAvailableMonths(months);
            setSelectedMonth(''); // Reset month selection when year changes
        } else {
            setAvailableMonths([]);
        }
    };
    fetchMonths();
  }, [selectedYear]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
      } else {
        toast({
            variant: "destructive",
            title: "잘못된 파일 유형",
            description: "PDF 파일을 업로드해주세요.",
        });
        setFile(null);
        event.target.value = '';
      }
    }
  };

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget; 
    if (!file || !selectedYear || !selectedMonth) {
      toast({
        variant: "destructive",
        title: "입력 필요",
        description: "연도, 월, PDF 파일을 모두 선택해주세요.",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const pdfDataUri = await fileToDataUri(file);
      const result = await uploadScriptsAndMatchToQuestions(pdfDataUri, parseInt(selectedYear), parseInt(selectedMonth), file.name);

      if (result.success) {
        toast({
          title: "대본 매칭 완료",
          description: `"${file.name}"에서 ${result.matchCount}개의 듣기 대본이 성공적으로 문제와 연결되었습니다.`,
        });
      } else {
        throw new Error(result.error || '대본 처리 중 알 수 없는 오류가 발생했습니다.');
      }
    } catch (error) {
       let errorMessage = "예기치 않은 오류가 발생했습니다.";
       if (error instanceof Error) {
         errorMessage = error.message;
       }
       toast({
         variant: "destructive",
         title: "업로드 실패",
         description: errorMessage,
       });
    } finally {
        setIsUploading(false);
        setFile(null);
        setSelectedYear('');
        setSelectedMonth('');
        const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement | null;
        if(fileInput) fileInput.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2 md:col-span-1">
            <Label htmlFor="year-select">시험 연도</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isUploading}>
                <SelectTrigger id="year-select">
                    <SelectValue placeholder="연도 선택" />
                </SelectTrigger>
                <SelectContent>
                    {availableYears.length > 0 ? (
                        availableYears.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
                        ))
                    ) : (
                        <SelectItem value="none" disabled>업로드된 시험지 없음</SelectItem>
                    )}
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2 md:col-span-1">
            <Label htmlFor="month-select">시험 월</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isUploading || !selectedYear}>
                <SelectTrigger id="month-select">
                    <SelectValue placeholder="월 선택" />
                </SelectTrigger>
                <SelectContent>
                    {availableMonths.length > 0 ? (
                        availableMonths.map(month => (
                            <SelectItem key={month} value={String(month)}>{month}월</SelectItem>
                        ))
                    ) : (
                        <SelectItem value="none" disabled>선택 가능한 월 없음</SelectItem>
                    )}
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pdf-file-scripts">듣기 대본 PDF 파일</Label>
            <Input id="pdf-file-scripts" type="file" accept="application/pdf" onChange={handleFileChange} disabled={isUploading} />
        </div>
      </div>
      <Button type="submit" disabled={!file || !selectedYear || !selectedMonth || isUploading || availableYears.length === 0}>
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            대본 연결 중...
          </>
        ) : (
            <>
            <FileUp className="mr-2 h-4 w-4" />
            업로드 및 대본 연결
            </>
        )}
      </Button>
    </form>
  );
}
