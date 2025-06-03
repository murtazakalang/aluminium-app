import { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In - Aluminium ERP',
  description: 'Sign in to your Aluminium ERP account',
};

export default function LoginPage() {
  return <LoginForm />;
} 