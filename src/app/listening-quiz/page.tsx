
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic } from 'lucide-react';
import { textToSpeech } from '@/lib/actions';

export default function ListeningQuizPage() {
  const [text, setText] = useState('');
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      toast({
        variant: 'destructive',
        title: '텍스트 필요',
        description: '음성으로 변환할 텍스트를 입력해주세요.',
      });
      return;
    }

    setIsLoading(true);
    setAudioDataUri(null);

    try {
      const result = await textToSpeech(text);

      if (result.success && result.data) {
        setAudioDataUri(result.data.audioDataUri);
        toast({
          title: '음성 생성 완료',
          description: '아래 플레이어에서 생성된 음성을 재생할 수 있습니다.',
        });
      } else {
        throw new Error(result.error || '음성 생성에 실패했습니다.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">AI 듣기 평가 생성기</h1>
        <p className="text-muted-foreground mt-2">
          텍스트를 입력하면 AI가 듣기 평가용 음성을 생성합니다.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>텍스트를 음성으로 변환</CardTitle>
          <CardDescription>
            듣기 평가 지문으로 사용할 텍스트를 아래에 입력하거나 붙여넣으세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid w-full gap-2">
              <Label htmlFor="script-text">지문 텍스트</Label>
              <Textarea
                id="script-text"
                placeholder="예: 다음 대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" disabled={!text || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  음성 생성
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {audioDataUri && (
        <Card>
          <CardHeader>
            <CardTitle>생성된 듣기 평가 음성</CardTitle>
          </CardHeader>
          <CardContent>
            <audio controls className="w-full" src={audioDataUri}>
              브라우저가 오디오 요소를 지원하지 않습니다.
            </audio>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
