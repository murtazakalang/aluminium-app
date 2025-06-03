'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/auth-store';

export function RegisterForm() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  
  // Company details
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  
  // User details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form validation
  const [passwordError, setPasswordError] = useState('');
  const [step, setStep] = useState(1); // 1 = company details, 2 = user details

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

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setStep(2);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    if (!validatePassword()) {
      return;
    }
    
    // Restructure the data to match backend validation expectations
    const registrationData = {
      companyName: companyName,
      companyEmail: companyEmail,
      adminFirstName: firstName,
      adminEmail: email,
      password: password,
      // Optional fields not strictly required by validator
      companyPhone: companyPhone,
      adminLastName: lastName
    };
    
    await register(registrationData);
    
    // Check if registration was successful
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Create an Account</h1>
        <p className="text-gray-500">
          {step === 1 
            ? 'Enter your company details to get started' 
            : 'Create your account credentials'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleCompanySubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="companyName" className="text-sm font-medium">
              Company Name
            </label>
            <Input
              id="companyName"
              type="text"
              placeholder="Your company name"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="companyEmail" className="text-sm font-medium">
              Company Email
            </label>
            <Input
              id="companyEmail"
              type="email"
              placeholder="company@example.com"
              required
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="companyPhone" className="text-sm font-medium">
              Company Phone
            </label>
            <Input
              id="companyPhone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              required
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
            />
          </div>
          
          <Button type="submit" className="w-full">
            Continue
          </Button>
          
          <div className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              Sign in
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium">
                First Name
              </label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last Name
              </label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          
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
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
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
              Confirm Password
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
          
          <div className="flex space-x-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1"
            >
              Back
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </div>
          
          <div className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              Sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
} 