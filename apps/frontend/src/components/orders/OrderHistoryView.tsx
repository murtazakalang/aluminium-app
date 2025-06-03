import React, { useState, useEffect } from 'react';
import { orderApi, type OrderHistoryEntry } from '@/lib/api/orderService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from './OrderStatusBadge';

interface OrderHistoryViewProps {
  orderId: string;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  orderId,
}) => {
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [orderIdDisplay, setOrderIdDisplay] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await orderApi.getHistory(orderId);
      setHistory(response.data.history);
      setOrderIdDisplay(response.data.orderIdDisplay);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchHistory();
    }
  }, [orderId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserName = (updatedBy: string | { _id?: string; firstName?: string; lastName?: string; email?: string; }) => {
    if (typeof updatedBy === 'string') {
      return 'System';
    }
    
    if (updatedBy && typeof updatedBy === 'object') {
      if (updatedBy.firstName || updatedBy.lastName) {
        return `${updatedBy.firstName || ''} ${updatedBy.lastName || ''}`.trim();
      }
      if (updatedBy.email) {
        return updatedBy.email;
      }
    }
    
    return 'Unknown User';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Loading order history...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-50 border-red-200">
        <div className="flex justify-between items-center">
          <p className="text-red-600">{error}</p>
          <Button
            onClick={fetchHistory}
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Order History {orderIdDisplay && `- ${orderIdDisplay}`}
          </h2>
          <Button
            onClick={fetchHistory}
            variant="outline"
            size="sm"
          >
            Refresh
          </Button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No history available for this order.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry, index) => (
              <div
                key={index}
                className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                {/* Timeline indicator */}
                <div className="flex-shrink-0 mt-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  {index < history.length - 1 && (
                    <div className="w-0.5 h-8 bg-gray-300 mx-auto mt-2"></div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <OrderStatusBadge status={entry.status} />
                      <span className="text-sm font-medium text-gray-900">
                        Status changed to {entry.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>

                  {entry.notes && (
                    <div className="mb-2">
                      <p className="text-sm text-gray-700 bg-white p-2 rounded border">
                        {entry.notes}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Updated by: {getUserName(entry.updatedBy || 'System')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Summary */}
      {history.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {history.length}
              </div>
              <div className="text-sm text-gray-600">Status Changes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {history[0]?.status || 'Unknown'}
              </div>
              <div className="text-sm text-gray-600">Current Status</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {history[history.length - 1] ? formatDate(history[history.length - 1].timestamp).split(',')[0] : '—'}
              </div>
              <div className="text-sm text-gray-600">Created Date</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}; 