import React from 'react';
import { Order } from '@/lib/api/orderService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Table from '@/components/ui/Table';

interface OrderItemsViewProps {
  order: Order;
  onRefresh: () => void;
}

export const OrderItemsView: React.FC<OrderItemsViewProps> = ({
  order,
  onRefresh,
}) => {

  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDimension = (value: number, unit: string) => {
    return `${value} ${unit}`;
  };

  // Transform items data for the table
  const tableData = order.items.map((item, index) => {
    return {
      id: item._id || index.toString(),
      productType: item.productTypeNameSnapshot || '—',
      itemLabel: item.itemLabel || '—',
      selectedGlassTypeNameSnapshot: item.selectedGlassTypeNameSnapshot,
      frameColour: item.frameColour,
      originalDimensions: item.originalWidth && item.originalHeight 
        ? `${formatDimension(item.originalWidth, order.dimensionUnit)} × ${formatDimension(item.originalHeight, order.dimensionUnit)}`
        : '—',
      finalDimensions: `${formatDimension(item.finalWidth, order.dimensionUnit)} × ${formatDimension(item.finalHeight, order.dimensionUnit)}`,
      originalQuantity: item.originalQuantity?.toString() || '—',
      finalQuantity: item.finalQuantity.toString(),
      finalArea: item.finalTotalChargeableArea 
        ? `${item.finalTotalChargeableArea} ${order.areaUnit}`
        : '—',
      pricePerUnit: formatCurrency(item.pricePerAreaUnit),
      itemSubtotal: item.finalItemSubtotal ? formatCurrency(item.finalItemSubtotal) : '—',
    };
  });



  const columns = [
    { 
      header: 'Product Type', 
      accessor: (item: any) => {
        return (
          <div>
            <div className="text-sm font-medium text-gray-900">{item.productType}</div>
            {item.selectedGlassTypeNameSnapshot && (
              <div className="text-xs text-gray-500">Glass: {item.selectedGlassTypeNameSnapshot}</div>
            )}
            {item.frameColour && (
              <div className="text-xs text-gray-500">Frame: {item.frameColour}</div>
            )}
          </div>
        );
      }
    },
    { header: 'Label', accessor: 'itemLabel' as const },
    { header: 'Original Dimensions', accessor: 'originalDimensions' as const },
    { header: 'Final Dimensions', accessor: 'finalDimensions' as const },
    { header: 'Original Qty', accessor: 'originalQuantity' as const },
    { header: 'Final Qty', accessor: 'finalQuantity' as const },
    { header: 'Final Area', accessor: 'finalArea' as const },
    { header: `Price per ${order.areaUnit}`, accessor: 'pricePerUnit' as const },
    { header: 'Subtotal', accessor: 'itemSubtotal' as const },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Order Items</h2>
          <div className="text-sm text-gray-600">
            Total Items: {order.items.length}
          </div>
        </div>

        <Table
          columns={columns}
          data={tableData}
          keyExtractor={(item) => item.id}
          emptyStateMessage="No items found"
        />
      </Card>

      {/* Charges */}
      {order.charges && order.charges.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Charges</h2>
          <div className="space-y-2">
            {order.charges.map((charge, index) => (
              <div key={charge._id || index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-900">{charge.description}</span>
                  {charge.isTax && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      Tax
                    </span>
                  )}
                  {charge.isPredefined && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      Predefined
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(charge.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Discount */}
      {order.discount && order.discount.value > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Discount</h2>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-900">
              {order.discount.type === 'percentage' ? 'Percentage Discount' : 'Fixed Discount'}
            </span>
            <span className="text-sm font-medium text-green-600">
              {order.discount.type === 'percentage' 
                ? `${order.discount.value}%`
                : formatCurrency(order.discount.value)
              }
            </span>
          </div>
        </Card>
      )}

      {/* Summary */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Items Subtotal:</span>
            <span className="text-sm font-medium">{formatCurrency(order.finalSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Additional Charges:</span>
            <span className="text-sm font-medium">{formatCurrency(order.finalTotalCharges)}</span>
          </div>
          {order.finalTotalTax > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Tax:</span>
              <span className="text-sm font-medium">{formatCurrency(order.finalTotalTax)}</span>
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
    </div>
  );
}; 