'use client';

import { Metadata } from 'next';
import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { redirect } from 'next/navigation';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    redirect('/forgot-password');
    return null;
  }

  return <ResetPasswordForm token={token} />;
} 