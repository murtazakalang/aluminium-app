'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/auth-store';

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const { resetPassword, isLoading, error, clearError } = useAuthStore();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const validatePassword = () => {
    if (password.length < 6) { // Changed to 6 characters to match backend validation
      setPasswordError('Password must be at least 6 characters long');
      return false;
    }
    
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    if (!validatePassword()) {
      return;
    }
    
    // Check if token has correct format (64 characters, hexadecimal)
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    if (!hexRegex.test(token)) {
      setPasswordError('Invalid reset token');
      return;
    }
    
    await resetPassword(token, password);
    
    // Check if there was no error
    if (!useAuthStore.getState().error) {
      setResetSuccess(true);
    }
  };

  if (resetSuccess) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Password Reset Complete</h1>
          <p className="text-gray-500">
            Your password has been successfully reset
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-md text-green-700 text-sm">
            <p>Your password has been reset successfully. You can now log in with your new password.</p>
          </div>
          <Link href="/login">
            <Button className="w-full">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-gray-500">
          Create a new secure password for your account
        </p>
      </div>

      {error && (
        <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            New Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Password must be at least 6 characters long
          </p>
        </div>
        
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm New Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
        </div>
        
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Resetting Password...' : 'Reset Password'}
        </Button>
        
        <div className="text-center text-sm">
          <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Back to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
} 