'use client';

import { useEffect, useState } from 'react';
import { Company } from '@/lib/types';
import { companyApi } from '@/lib/api';
import CompanyForm from '@/components/settings/CompanyForm';

export default function CompanyProfilePage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompany = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await companyApi.getMyCompany();
      // Extract company data from the nested response structure
      const companyData = response.data?.company;
      if (companyData) {
        setCompany(companyData);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err) {
      setError('Failed to load company profile. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading company details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center">
        <p className="text-gray-500">No company profile found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Company Profile</h3>
        <p className="text-sm text-gray-500">
          Manage your company details and default settings.
        </p>
      </div>
      <CompanyForm initialData={company} onRefresh={fetchCompany} />
    </div>
  );
} 