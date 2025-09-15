
import UploadForm from '@/components/upload-form';
import ScriptUploadForm from '@/components/script-upload-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getAvailableYears } from '@/lib/data';

export default async function UploadPage() {
  const availableYears = await getAvailableYears();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">자료 업로드</h1>
        <p className="text-muted-foreground mt-2">
          수능 또는 모의고사 시험지 PDF와 듣기 평가 대본 PDF를 업로드하여 문제 은행을 구성하세요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1단계: 시험지 PDF 업로드</CardTitle>
          <CardDescription>
            먼저 문제, 선택지, 정답, 해설이 포함된 시험지 PDF를 업로드하세요.
            AI가 문서를 처리하여 문제 데이터를 추출합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>
      
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>2단계: 듣기 대본 PDF 업로드 (선택 사항)</CardTitle>
          <CardDescription>
            시험지에 듣기 평가가 포함된 경우, 해당 시험의 연도와 월을 선택하고 듣기 대본 PDF를 업로드하세요.
            AI가 대본을 문제와 자동으로 연결합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScriptUploadForm availableYears={availableYears} />
        </CardContent>
      </Card>
    </div>
  );
}
