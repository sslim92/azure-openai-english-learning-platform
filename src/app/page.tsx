
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import LandingPage from '@/app/landing/page';
import DashboardPage from '@/components/dashboard-page';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen">
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
    );
  }

  return user ? <DashboardPage /> : <LandingPage />;
}
