'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InviteForm from '@/components/settings/InviteForm';
import { useAuthStore } from '@/lib/store/auth-store';

export default function InviteStaffPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';

  // Redirect if not an admin
  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard/settings/staff');
    }
  }, [isAdmin, router]);

  if (!isAdmin) {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Invite Staff Member</h3>
        <p className="text-sm text-gray-500">
          Send an email invitation to allow a new user to join your company.
        </p>
      </div>
      <InviteForm />
    </div>
  );
} 