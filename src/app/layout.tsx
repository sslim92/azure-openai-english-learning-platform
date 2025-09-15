
'use client';

import { usePathname } from 'next/navigation';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { AuthProvider } from '@/context/auth-context';

function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
          <div className="relative flex min-h-dvh">
            <AppSidebar />
            <SidebarInset className="min-h-dvh flex-1 flex-col !p-0">
              <Header />
              <main className='flex-1 p-4 sm:p-6 lg:p-8'>
                {children}
              </main>
            </SidebarInset>
          </div>
          <Toaster />
        </SidebarProvider>
    );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const noAppLayoutRoutes = ['/landing', '/login', '/'];

  const useAppLayout = !noAppLayoutRoutes.includes(pathname);

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <title>메기스터디</title>
        <meta name="description" content="AI 메기 멘토와 함께하는 수능 영어 학습" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
         <AuthProvider>
            {useAppLayout ? (
              <AppLayout>
                {children}
              </AppLayout>
            ) : (
              <>
                {children}
                <Toaster />
              </>
            )}
            <ProgressBar
                height="4px"
                color="hsl(var(--primary))"
                options={{ showSpinner: false }}
                shallowRouting
            />
        </AuthProvider>
      </body>
    </html>
  );
}
