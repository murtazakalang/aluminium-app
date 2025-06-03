import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Order } from '@/lib/api/orderService';
import { invoiceApi } from '@/lib/api/invoiceService';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderStatusUpdater } from './OrderStatusUpdater';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from 'sonner';
import { FilePlus2 } from 'lucide-react';

interface OrderDetailViewProps {
  order: Order;
  onStatusUpdate: (newStatus: string, notes?: string) => void;
  onRefresh: () => void;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  order,
  onStatusUpdate,
  onRefresh,
}) => {
  const { user } = useAuthStore();
  const router = useRouter();
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canConfirmMeasurements = 
    (user?.role === 'Admin' || user?.role === 'Manager') &&
    ['Pending', 'Measurement Confirmed'].includes(order.status);

  const canCreateInvoice = order.status !== 'Cancelled' && 
                           (user?.role === 'Admin' || user?.role === 'Manager');

  const handleCreateInvoice = async () => {
    if (!order || !canCreateInvoice) return;

    setIsCreatingInvoice(true);
    try {
      const response = await invoiceApi.createInvoiceFromOrder(order._id);
      toast.success('Invoice created successfully!');
      if (response.data.invoice && response.data.invoice._id) {
        router.push(`/dashboard/invoices/${response.data.invoice._id}`);
      }
      onRefresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create invoice';
      toast.error(errorMessage);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Order Status and Actions */}
      <Card className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Status</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <OrderStatusUpdater
              orderId={order._id}
              currentStatus={order.status}
              onStatusUpdate={onStatusUpdate}
            />
            {canConfirmMeasurements && (
              <Button
                onClick={() => router.push(`/dashboard/orders/${order._id}/confirm-measurements`)}
                variant="default"
                size="sm"
              >
                Confirm Measurements
              </Button>
            )}
            {canCreateInvoice && (
              <Button
                onClick={handleCreateInvoice}
                variant="default"
                size="sm"
                disabled={isCreatingInvoice}
                className="bg-green-600 hover:bg-green-700"
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                {isCreatingInvoice ? 'Creating Invoice...' : 'Create Invoice'}
              </Button>
            )}
          </div>
        </div>

        {order.measurementConfirmedBy && order.measurementConfirmedAt && (
          <div className="text-sm text-gray-600">
            Measurements confirmed on {formatDate(order.measurementConfirmedAt)}
            {typeof order.measurementConfirmedBy === 'object' && order.measurementConfirmedBy.firstName && (
              <span> by {order.measurementConfirmedBy.firstName} {order.measurementConfirmedBy.lastName}</span>
            )}
          </div>
        )}
      </Card>

      {/* Client Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Client Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Client Name</label>
            <p className="mt-1 text-sm text-gray-900">{order.clientSnapshot.clientName}</p>
          </div>
          {order.clientSnapshot.contactPerson && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Person</label>
              <p className="mt-1 text-sm text-gray-900">{order.clientSnapshot.contactPerson}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Contact Number</label>
            <p className="mt-1 text-sm text-gray-900">{order.clientSnapshot.contactNumber}</p>
          </div>
          {order.clientSnapshot.email && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{order.clientSnapshot.email}</p>
            </div>
          )}
          {order.clientSnapshot.billingAddress && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Billing Address</label>
              <p className="mt-1 text-sm text-gray-900">{order.clientSnapshot.billingAddress}</p>
            </div>
          )}
          {order.clientSnapshot.siteAddress && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Site Address</label>
              <p className="mt-1 text-sm text-gray-900">{order.clientSnapshot.siteAddress}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Order Details */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Order ID</label>
            <p className="mt-1 text-sm text-gray-900">{order.orderIdDisplay}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Quotation ID</label>
            <p className="mt-1 text-sm text-gray-900">{order.quotationIdDisplaySnapshot || '—'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Dimension Unit</label>
            <p className="mt-1 text-sm text-gray-900">{order.dimensionUnit}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Area Unit</label>
            <p className="mt-1 text-sm text-gray-900">{order.areaUnit}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Created Date</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Updated</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(order.updatedAt)}</p>
          </div>
        </div>
      </Card>

      {/* Financial Summary */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Financial Summary</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Subtotal:</span>
            <span className="text-sm font-medium">{formatCurrency(order.finalSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Charges:</span>
            <span className="text-sm font-medium">{formatCurrency(order.finalTotalCharges)}</span>
          </div>
          {order.finalTotalTax > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Tax:</span>
              <span className="text-sm font-medium">{formatCurrency(order.finalTotalTax)}</span>
            </div>
          )}
          {order.discount && order.discount.value > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">
                Discount ({order.discount.type === 'percentage' ? `${order.discount.value}%` : 'Fixed'}):
              </span>
              <span className="text-sm font-medium text-green-600">
                -{order.discount.type === 'percentage' 
                  ? formatCurrency((order.finalSubtotal + order.finalTotalCharges) * order.discount.value / 100)
                  : formatCurrency(order.discount.value)
                }
              </span>
            </div>
          )}
          <div className="border-t pt-3">
            <div className="flex justify-between">
              <span className="text-lg font-semibold">Grand Total:</span>
              <span className="text-lg font-bold text-blue-600">{formatCurrency(order.finalGrandTotal)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
        </Card>
      )}

      {/* Terms and Conditions */}
      {order.termsAndConditions && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Terms and Conditions</h2>
          <div 
            className="text-sm text-gray-700 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: order.termsAndConditions }}
          />
        </Card>
      )}
    </div>
  );
}; 