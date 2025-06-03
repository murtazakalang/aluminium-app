import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center">
            {/* Replace with your logo */}
            <span className="text-2xl font-bold text-blue-600">Aluminium ERP</span>
          </Link>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-md">
          {children}
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Aluminium ERP. All rights reserved.
        </div>
      </div>
    </div>
  );
} 