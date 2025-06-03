'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Staff } from '@/lib/types';
import { staffApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/auth-store';
import Table from '@/components/ui/Table';

interface StaffTableProps {
  staffList: Staff[];
  onRefresh: () => void;
}

export default function StaffTable({ staffList, onRefresh }: StaffTableProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isCurrentUser = (userId: string) => {
    return user?.id === userId;
  };

  const isAdmin = user?.role === 'Admin';

  const toggleStatus = async (staff: Staff) => {
    if (processingIds.has(staff._id)) return;
    setError(null);

    try {
      setProcessingIds((prev) => new Set([...prev, staff._id]));
      await staffApi.updateStatus(staff._id, !staff.isActive);
      onRefresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(staff._id);
        return newSet;
      });
    }
  };

  const handleDeleteStaff = async (staffMember: Staff) => {
    if (processingIds.has(staffMember._id)) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${getFullName(staffMember)} (${staffMember.email})? This action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    setError(null);
    try {
      setProcessingIds((prev) => new Set([...prev, staffMember._id]));
      await staffApi.deleteStaff(staffMember._id);
      onRefresh(); // Refresh the list from the parent component
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff member.');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(staffMember._id);
        return newSet;
      });
    }
  };

  const statusBadge = (status: boolean) => {
    return status ? (
      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
        Active
      </span>
    ) : (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
        Inactive
      </span>
    );
  };

  const getFullName = (staff: Staff) => {
    if (staff.firstName && staff.lastName) {
      return `${staff.firstName} ${staff.lastName}`;
    }
    if (staff.firstName) {
      return staff.firstName;
    }
    if (staff.lastName) {
      return staff.lastName;
    }
    return 'Unnamed';
  };

  const columns = [
    {
      header: 'Name',
      accessor: (staff: Staff) => (
        <div>
          <div>{getFullName(staff)}</div>
          <div className="text-xs text-gray-500">{staff.email}</div>
        </div>
      ),
    },
    {
      header: 'Role',
      accessor: 'role',
    },
    {
      header: 'Status',
      accessor: (staff: Staff) => statusBadge(staff.isActive),
    },
    {
      header: 'Actions',
      accessor: (staffMember: Staff) => {
        const processing = processingIds.has(staffMember._id);
        const canEdit = isAdmin || (!isAdmin && staffMember.role !== 'Admin');
        
        return (
          <div className="flex space-x-2">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/settings/staff/${staffMember._id}/edit`)}
                disabled={processing}
              >
                Edit
              </Button>
            )}
            {isAdmin && !isCurrentUser(staffMember._id) && (
              <>
                <Button
                  variant={staffMember.isActive ? 'destructive' : 'secondary'}
                  size="sm"
                  onClick={() => toggleStatus(staffMember)}
                  disabled={processing}
                >
                  {processing && staffMember.isActive ? 'Deactivating...' : processing && !staffMember.isActive ? 'Activating...' : staffMember.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteStaff(staffMember)}
                  disabled={processing}
                >
                  {processing ? 'Deleting...' : 'Delete'}
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
      <Table
        columns={columns}
        data={staffList}
        keyExtractor={(staff) => staff._id}
        emptyStateMessage="No staff members found"
      />
    </div>
  );
} 
 