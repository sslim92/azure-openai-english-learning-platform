'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';


export default function LoginPage() {
  const { signup, login, loading, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "이메일과 비밀번호를 모두 입력해주세요.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
      // Success is handled by the useEffect
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: error.message || "이메일 또는 비밀번호를 확인해주세요.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
     if (!signupEmail || !signupPassword || !signupDisplayName) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "닉네임, 이메일, 비밀번호를 모두 입력해주세요.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await signup(signupEmail, signupPassword, signupDisplayName);
       toast({
        title: "✅ 회원가입 성공!",
        description: "로그인 탭으로 이동하여 로그인해주세요.",
      });
      // Switch to login tab after successful signup could be a good UX,
      // for now, we'll let the user log in manually.
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "회원가입 실패",
        description: error.message || "입력 정보를 확인해주세요.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="absolute top-4 left-4">
        <Button asChild variant="ghost">
          <Link href="/landing">
            &larr; 홈으로 돌아가기
          </Link>
        </Button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>EduSearch Pro</CardTitle>
          <CardDescription>
            계정에 로그인하거나 새로 만드세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">이메일</Label>
                  <Input id="login-email" type="email" placeholder="user@example.com" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">비밀번호</Label>
                  <Input id="login-password" type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "로그인"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
               <form onSubmit={handleSignup} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-display-name">닉네임</Label>
                  <Input id="signup-display-name" type="text" placeholder="메기" required value={signupDisplayName} onChange={e => setSignupDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일</Label>
                  <Input id="signup-email" type="email" placeholder="user@example.com" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input id="signup-password" type="password" placeholder="6자 이상 입력" required value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "회원가입"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
