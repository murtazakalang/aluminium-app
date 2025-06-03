'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormInput } from '@/components/ui/FormInput';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { useAuthStore } from '@/lib/store/auth-store';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams?.get('returnUrl') || '/dashboard';
  
  const { login, isLoading, error, isAuthenticated, token, user, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Clear any existing errors on mount
  useEffect(() => {
    clearError();
  }, [clearError]);
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && token && user) {
      router.push(returnUrl);
    }
  }, [isAuthenticated, token, user, router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    await login(email, password);
    // We don't redirect here - the useEffect will handle that
    // only if login was successful
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Sign In</h1>
        <p className="text-gray-500">Enter your credentials to access your account</p>
      </div>

      {error && (
        <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Email"
          id="email"
          type="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link 
              href="/forgot-password" 
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Forgot password?
            </Link>
          </div>
          <FormInput
            id="password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            label=""
            className="mt-0"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            id="remember-me"
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label htmlFor="remember-me" className="text-sm text-gray-700">
            Remember me
          </label>
        </div>
        
        <LoadingButton
          type="submit"
          className="w-full"
          isLoading={isLoading}
        >
          Sign In
        </LoadingButton>
      </form>
      
      <div className="text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-blue-600 hover:text-blue-800 font-medium">
          Sign up
        </Link>
      </div>
    </div>
  );
} 