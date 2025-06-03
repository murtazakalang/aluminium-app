'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffApi } from '@/lib/api';
import { InviteStaffData } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { LoadingButton } from '@/components/ui/LoadingButton';
import RoleSelector from './RoleSelector';

export default function InviteForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<InviteStaffData>({
    email: '',
    role: 'Staff',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof InviteStaffData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof InviteStaffData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRoleChange = (role: string) => {
    const validRole = role as 'Admin' | 'Manager' | 'Staff';
    setFormData((prev) => ({ ...prev, role: validRole }));
    if (errors.role) {
      setErrors((prev) => ({ ...prev, role: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof InviteStaffData, string>> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.role) {
      newErrors.role = 'Role is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccess(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await staffApi.inviteStaff(formData);
      setSuccess(`Invitation sent to ${formData.email}`);
      // Clear form
      setFormData({ email: '', role: 'Staff' });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="text-sm text-red-700">{serverError}</div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        </div>
      )}
      
      <div className="max-w-md space-y-6">
        <p className="text-sm text-gray-500">
          Send an invitation email to add a new staff member. They will receive a link to set up their password.
        </p>
        
        <FormInput
          label="Email"
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          required
        />
        
        <RoleSelector 
          value={formData.role} 
          onChange={handleRoleChange} 
          error={errors.role} 
        />
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/dashboard/settings/staff')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <LoadingButton type="submit" isLoading={isSubmitting}>
          Send Invitation
        </LoadingButton>
      </div>
    </form>
  );
} 