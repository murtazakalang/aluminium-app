'use client';

import React, { useState } from 'react';
import Link from 'next/link';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/auth-store';

export function ForgotPasswordForm() {
  const { forgotPassword, isLoading, error, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    await forgotPassword(email);
    
    // Check if there was no error
    if (!useAuthStore.getState().error) {
      setSubmitted(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-gray-500">
          Enter your email and we&apos;ll send you instructions to reset your password
        </p>
      </div>

      {submitted ? (
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-md text-green-700 text-sm">
            <p>If an account exists with the email <strong>{email}</strong>, you will receive password reset instructions.</p>
          </div>
          <Link href="/login">
            <Button className="w-full" variant="secondary">
              Return to Sign In
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Instructions'}
            </Button>
          </form>
          
          <div className="text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              Back to Sign In
            </Link>
          </div>
        </>
      )}
    </div>
  );
} 