import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: string;
  onStatusUpdate: (newStatus: string, notes?: string) => void;
  onRefresh?: () => void;
}

export const OrderStatusUpdater: React.FC<OrderStatusUpdaterProps> = ({
  orderId,
  currentStatus,
  onStatusUpdate,
}) => {
  const { user } = useAuthStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<string | null>(null);

  // Only Admin and Manager can update order status
  const canUpdateStatus = user?.role === 'Admin' || user?.role === 'Manager';

  if (!canUpdateStatus) {
    return null;
  }

  const statusOptions = [
    'Pending',
    'Measurement Confirmed',
    'Ready for Optimization',
    'Optimization Complete',
    'In Production',
    'Cutting',
    'Assembly',
    'QC',
    'Packed',
    'Ready for Dispatch',
    'Delivered',
    'Completed',
    'Cancelled',
  ];

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;

    setIsUpdating(true);
    try {
      await onStatusUpdate(newStatus, notes || undefined);
      setNotes('');
      setShowNotes(false);
      setPendingStatusUpdate(null);
    } catch {
      // Handle error silently or add proper error handling
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus && newStatus !== currentStatus) {
      // For certain status changes, show notes input
      if (['Cancelled', 'Completed'].includes(newStatus)) {
        setPendingStatusUpdate(newStatus);
        setShowNotes(true);
      } else {
        handleStatusChange(newStatus);
      }
    }
  };

  const handleNotesSubmit = () => {
    if (pendingStatusUpdate) {
      handleStatusChange(pendingStatusUpdate);
    }
  };

  return (
    <div className="relative">
      <select
        id={`status-select-${orderId}`}
        className="text-xs px-2 py-1 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={currentStatus}
        onChange={handleStatusSelect}
        disabled={isUpdating}
      >
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      {showNotes && (
        <div className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-64">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Notes (optional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Add notes for this status change..."
            />
            <div className="flex space-x-2">
              <button
                type="button"
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={handleNotesSubmit}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : 'Update'}
              </button>
              <button
                type="button"
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={() => {
                  setShowNotes(false);
                  setNotes('');
                  setPendingStatusUpdate(null);
                  // Reset select to current status
                  const select = document.getElementById(`status-select-${orderId}`) as HTMLSelectElement;
                  if (select) select.value = currentStatus;
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 