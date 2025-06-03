'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, token, user } = useAuthStore();

  useEffect(() => {
    // Check if the user is not authenticated
    if (!isAuthenticated || !token || !user) {
      // Redirect to login page with the return URL
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?returnUrl=${returnUrl}`);
    }
  }, [isAuthenticated, token, user, router, pathname]);

  // If not authenticated, render nothing while redirecting
  if (!isAuthenticated || !token || !user) {
    return <div className="flex h-screen items-center justify-center">Checking authentication...</div>;
  }

  // If authenticated, render the children
  return <>{children}</>;
} 