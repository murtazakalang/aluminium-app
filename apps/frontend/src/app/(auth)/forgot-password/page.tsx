import { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot Password - Aluminium ERP',
  description: 'Reset your Aluminium ERP password',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
} 