'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffApi } from '@/lib/api';
import { Staff } from '@/lib/types';
import StaffForm from '@/components/settings/StaffForm';
import { useAuthStore } from '@/lib/store/auth-store';
import { use } from 'react';

interface EditStaffPageProps {
  params: {
    userId: string;
  };
}

export default function EditStaffPage({ params }: EditStaffPageProps) {
  const { userId } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const [staffData, setStaffData] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'Admin';
  const isCurrentUser = user?.id === userId;

  // Check permissions:
  // - Admins can edit anyone
  // - Other roles can only edit their own account
  // - Non-admins cannot edit admins
  const canEdit = isAdmin || isCurrentUser;

  useEffect(() => {
    const fetchStaffData = async () => {
      if (!canEdit) {
        router.push('/dashboard/settings/staff');
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        const data = await staffApi.getStaff(userId);
        setStaffData(data);
        
        // Additional check - non-admins cannot edit admin users
        if (!isAdmin && data.role === 'Admin') {
          router.push('/dashboard/settings/staff');
        }
      } catch (err) {
        setError('Failed to load staff details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaffData();
  }, [userId, canEdit, router, isAdmin]);

  if (!canEdit) {
    return null; // Don't render anything if user doesn't have permission
  }

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading staff details...</div>
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

  if (!staffData) {
    return (
      <div className="text-center">
        <p className="text-gray-500">Staff member not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Edit Staff Member</h3>
        <p className="text-sm text-gray-500">
          Update staff details and permissions.
        </p>
      </div>
      <StaffForm initialData={staffData} isEdit={true} />
    </div>
  );
} 