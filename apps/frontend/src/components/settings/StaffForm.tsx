'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffApi } from '@/lib/api';
import { Staff, StaffFormData } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { LoadingButton } from '@/components/ui/LoadingButton';
import RoleSelector from './RoleSelector';

interface StaffFormProps {
  initialData?: Staff;
  isEdit?: boolean;
}

export default function StaffForm({ initialData, isEdit = false }: StaffFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<StaffFormData>({
    email: initialData?.email || '',
    password: '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    phone: initialData?.phone || '',
    role: initialData?.role || 'Staff',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof StaffFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when field is changed
    if (errors[name as keyof StaffFormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRoleChange = (role: string) => {
    // Ensure role is one of the valid roles
    const validRole = role as 'Admin' | 'Manager' | 'Staff';
    setFormData((prev) => ({ ...prev, role: validRole }));
    if (errors.role) {
      setErrors((prev) => ({ ...prev, role: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof StaffFormData, string>> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!isEdit && !formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isEdit && formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
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
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (isEdit && initialData) {
        // If password is empty for edit, remove it from the form data
        const dataToSend = { ...formData };
        if (!dataToSend.password) {
          delete dataToSend.password;
        }
        await staffApi.updateStaff(initialData._id, dataToSend);
      } else {
        await staffApi.createStaff(formData);
      }
      
      router.push('/dashboard/settings/staff');
      router.refresh();
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
      
      <div className="grid gap-6 md:grid-cols-2">
        <FormInput
          label="Email"
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          disabled={isEdit} // Email cannot be changed once created
          required
        />
        
        {!isEdit && (
          <FormInput
            label="Password"
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            required={!isEdit}
          />
        )}
        
        {isEdit && (
          <FormInput
            label="New Password (leave blank to keep current)"
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
          />
        )}
        
        <FormInput
          label="First Name"
          id="firstName"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          error={errors.firstName}
        />
        
        <FormInput
          label="Last Name"
          id="lastName"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          error={errors.lastName}
        />
        
        <FormInput
          label="Phone"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          error={errors.phone}
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
          {isEdit ? 'Update Staff' : 'Create Staff'}
        </LoadingButton>
      </div>
    </form>
  );
} 