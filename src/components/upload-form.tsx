
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileUp } from 'lucide-react';
import { uploadPdfAndExtractQuestions } from '@/lib/actions';
import { useRouter } from 'next/navigation';

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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
        event.target.value = ''; // Reset file input
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
    if (!file) {
      toast({
        variant: "destructive",
        title: "선택된 파일 없음",
        description: "업로드할 PDF 파일을 선택해주세요.",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const pdfDataUri = await fileToDataUri(file);
      const result = await uploadPdfAndExtractQuestions(pdfDataUri, file.name);

      if (result.success) {
        if (result.questionCount > 0) {
          toast({
            title: "추출 완료",
            description: `"${file.name}"에서 ${result.questionCount}개의 문제가 성공적으로 추출되어 저장되었습니다.`,
          });
          router.push('/questions'); // 성공 시 문제 은행 페이지로 이동
          router.refresh(); // 페이지 새로고침으로 새 데이터 로드
        } else {
           toast({
            title: "문제 없음",
            description: `"${file.name}"에서 추출할 수 있는 문제를 찾지 못했습니다. PDF 내용이나 형식을 확인해주세요.`,
            variant: "destructive",
          });
        }
      } else {
        throw new Error(result.error || '추출 중 알 수 없는 오류가 발생했습니다.');
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
        const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement | null;
        if(fileInput) fileInput.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="pdf-file-questions">시험지 PDF 파일</Label>
        <Input id="pdf-file-questions" type="file" accept="application/pdf" onChange={handleFileChange} disabled={isUploading} />
      </div>
      <Button type="submit" disabled={!file || isUploading}>
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            문제 추출 중...
          </>
        ) : (
            <>
            <FileUp className="mr-2 h-4 w-4" />
            업로드 및 문제 추출
            </>
        )}
      </Button>
    </form>
  );
}
