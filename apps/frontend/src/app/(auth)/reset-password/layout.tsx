import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password - Aluminium ERP',
  description: 'Set a new password for your Aluminium ERP account',
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 