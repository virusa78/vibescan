'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuthClient, getAccessTokenClient } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authReady, setAuthReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const redirectParam = pathname && pathname !== '/' ? pathname.replace(/^\//, '') : 'dashboard';

    const verify = async () => {
      if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
        if (mounted) setAuthReady(true);
        return;
      }

      const token = getAccessTokenClient();
      if (!token) {
        router.replace(`/login?redirect=${encodeURIComponent(redirectParam)}`);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          clearAuthClient(`/login?redirect=${encodeURIComponent(redirectParam)}`);
          return;
        }

        if (mounted) setAuthReady(true);
      } catch {
        clearAuthClient(`/login?redirect=${encodeURIComponent(redirectParam)}`);
      }
    };

    void verify();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!authReady && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-500 flex items-center justify-center">
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}
