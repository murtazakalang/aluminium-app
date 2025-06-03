import { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Sign Up - Aluminium ERP',
  description: 'Create a new account for your company',
};

export default function RegisterPage() {
  return <RegisterForm />;
} 