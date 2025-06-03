'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Company } from '@/lib/types';
import { companyApi } from '@/lib/api';
import { FormInput } from '@/components/ui/FormInput';
import { LoadingButton } from '@/components/ui/LoadingButton';

interface CompanyFormProps {
  initialData: Company;
  onRefresh: () => void;
}

export default function CompanyForm({ initialData, onRefresh }: CompanyFormProps) {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    email: initialData.email || '',
    phone: initialData.phone || '',
    address: initialData.address || '',
    industry: initialData.industry || '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Logo upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form data when initialData changes
  useEffect(() => {
    setFormData({
      name: initialData.name || '',
      email: initialData.email || '',
      phone: initialData.phone || '',
      address: initialData.address || '',
      industry: initialData.industry || '',
    });
    
    // Set logo preview if company has a logo
    if (initialData.logoUrl) {
      setLogoPreview(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${initialData.logoUrl}`);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when field is changed
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    // Clear success and server error messages when user starts editing
    if (success || serverError) {
      setSuccess(null);
      setServerError(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name) {
      newErrors.name = 'Company name is required';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
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
      const response = await companyApi.updateMyCompany(formData);
      
      // Check if the response is successful
      if (response && (response.status === 'success' || response.data?.company)) {
        setSuccess('Company details updated successfully');
        onRefresh(); // Refresh company data
      } else {
        throw new Error('Failed to update company details');
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logo upload handlers
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setServerError('Please select an image file');
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setServerError('File size must be less than 5MB');
        return;
      }
      
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      setServerError(null);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    
    setIsUploadingLogo(true);
    setServerError(null);
    
    try {
      const response = await companyApi.uploadLogo(logoFile);
      if (response.status === 'success') {
        setSuccess('Logo uploaded successfully');
        setLogoFile(null);
        onRefresh(); // Refresh company data to get new logo URL
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    setIsRemovingLogo(true);
    setServerError(null);
    
    try {
      const response = await companyApi.removeLogo();
      if (response.status === 'success') {
        setSuccess('Logo removed successfully');
        setLogoPreview(null);
        setLogoFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onRefresh(); // Refresh company data
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Failed to remove logo');
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const cancelLogoSelection = () => {
    setLogoFile(null);
    setLogoPreview(initialData.logoUrl ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${initialData.logoUrl}` : null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      
      <div className="grid gap-6 md:grid-cols-2">
        <FormInput
          label="Company Name"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
        />
        
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
        
        <FormInput
          label="Phone"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          error={errors.phone}
        />
        
        <FormInput
          label="Address"
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          error={errors.address}
        />
        
        <FormInput
          label="Industry"
          id="industry"
          name="industry"
          value={formData.industry}
          onChange={handleChange}
          error={errors.industry}
        />
      </div>
      
      {/* Logo Upload Section */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Company Logo</h4>
        <div className="flex items-start space-x-4">
          <div className="flex-1">
            <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-2">
              Upload Logo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id="logo"
              accept="image/*"
              onChange={handleLogoFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <p className="mt-1 text-sm text-gray-500">
              PNG, JPG, GIF up to 5MB
            </p>
          </div>
          
          {/* Logo Preview */}
          {logoPreview && (
            <div className="flex-shrink-0">
              <div className="w-24 h-24 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                <img
                  src={logoPreview}
                  alt="Company Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Logo Action Buttons */}
        {logoFile && (
          <div className="flex space-x-2">
            <LoadingButton
              type="button"
              onClick={handleLogoUpload}
              isLoading={isUploadingLogo}
              className="bg-green-600 hover:bg-green-700"
            >
              Upload Logo
            </LoadingButton>
            <button
              type="button"
              onClick={cancelLogoSelection}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        )}
        
        {initialData.logoUrl && !logoFile && (
          <div className="flex space-x-2">
            <LoadingButton
              type="button"
              onClick={handleLogoRemove}
              isLoading={isRemovingLogo}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Logo
            </LoadingButton>
          </div>
        )}
      </div>
      
      {/* Informational note about unit settings relocation */}
      <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
        Default units for dimension and area have been moved to the <strong>General</strong> tab.
      </div>
      
      <div className="flex justify-end">
        <LoadingButton type="submit" isLoading={isSubmitting}>
          Save Changes
        </LoadingButton>
      </div>
    </form>
  );
} 