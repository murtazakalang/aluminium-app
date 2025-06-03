'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Staff } from '@/lib/types';
import { staffApi } from '@/lib/api';
import StaffTable from '@/components/settings/StaffTable';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/auth-store';

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';

  const fetchStaff = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await staffApi.listStaff();
      setStaffList(data);
    } catch (err) {
      setError('Failed to load staff members. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Staff Management</h3>
          <p className="text-sm text-gray-500">
            Manage staff members and their access to the system.
          </p>
        </div>
        {isAdmin && (
          <div className="flex space-x-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/staff/invite">Invite Staff</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/settings/staff/new">Add Staff</Link>
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}

      <StaffTable 
        staffList={staffList} 
        onRefresh={fetchStaff} 
      />
    </div>
  );
} 