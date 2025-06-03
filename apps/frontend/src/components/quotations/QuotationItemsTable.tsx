import React from 'react';
import { QuotationItem, Quotation } from '@/lib/types';

interface QuotationItemsTableProps {
  items: QuotationItem[];
  dimensionUnit: Quotation['dimensionUnit'];
  areaUnit: Quotation['areaUnit'];
  isLoading?: boolean;
}

// Helper function to safely convert Decimal128 or any value to a number
const formatDecimal = (value: any): string => {
  if (!value) return '0.00';
  
  // If it's a Decimal128 object with $numberDecimal property
  if (typeof value === 'object' && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  
  // If it's already a number or string
  const numValue = typeof value === 'number' ? value : parseFloat(value.toString());
  return isNaN(numValue) ? '0.00' : numValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Helper function to format dimensions
const formatDimension = (value: any): string => {
  if (!value) return '0.00';
  
  // If it's a Decimal128 object with $numberDecimal property
  if (typeof value === 'object' && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal).toFixed(2);
  }
  
  // If it's already a number or string
  const numValue = typeof value === 'number' ? value : parseFloat(value.toString());
  return isNaN(numValue) ? '0.00' : numValue.toFixed(2);
};

const QuotationItemsTable: React.FC<QuotationItemsTableProps> = ({
  items,
  dimensionUnit,
  areaUnit,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Items</h2>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Items</h2>
        <p className="text-gray-500">No items in this quotation.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h2 className="text-lg font-semibold mb-4">Items</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                W × H ({dimensionUnit})
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chg. Area/Item ({areaUnit})
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Chg. Area ({areaUnit})
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price/{areaUnit}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Subtotal
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={item._id || `item-${index}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {item.productTypeNameSnapshot || 'N/A'}
                    </div>
                    {item.itemLabel && (
                      <div className="text-sm text-gray-500">{item.itemLabel}</div>
                    )}
                    {item.selectedGlassTypeNameSnapshot && (
                      <div className="text-xs text-gray-500">
                        Glass Type: {item.selectedGlassTypeNameSnapshot}
                      </div>
                    )}
                    {item.frameColour && (
                      <div className="text-xs text-gray-500">
                        Frame Colour: {item.frameColour}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDimension(item.width)} × {formatDimension(item.height)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.quantity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDecimal(item.chargeableAreaPerItem)} 
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDecimal(item.totalChargeableArea)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₹{formatDecimal(item.pricePerAreaUnit)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₹{formatDecimal(item.itemSubtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuotationItemsTable; 