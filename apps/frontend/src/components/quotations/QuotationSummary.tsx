import React from 'react';
import { QuotationCharge, QuotationDiscount } from '@/lib/types';

interface QuotationSummaryProps {
  subtotal: number;
  charges?: QuotationCharge[];
  totalChargesAmount?: number;
  discount?: QuotationDiscount;
  discountAmountCalculated?: number;
  grandTotal: number;
  showDetails?: boolean;
}

const QuotationSummary: React.FC<QuotationSummaryProps> = ({
  subtotal,
  charges = [],
  totalChargesAmount = 0,
  discount,
  discountAmountCalculated = 0,
  grandTotal,
  showDetails = true
}) => {
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h2 className="text-lg font-semibold mb-4">Summary</h2>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Subtotal</span>
          <span className="text-sm font-medium">{formatCurrency(subtotal)}</span>
        </div>

        {showDetails && charges && charges.length > 0 && (
          <>
            {charges.map((charge, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {charge.description}
                  {charge.isTax && <span className="text-xs text-blue-600 ml-1">(Tax)</span>}
                </span>
                <span className="text-sm font-medium">{formatCurrency(charge.amount)}</span>
              </div>
            ))}
          </>
        )}

        {!showDetails && totalChargesAmount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Charges</span>
            <span className="text-sm font-medium">{formatCurrency(totalChargesAmount)}</span>
          </div>
        )}

        {discount && discount.value > 0 && discountAmountCalculated > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Discount ({discount.type === 'percentage' ? `${Number(discount.value).toLocaleString()}%` : 'Fixed'})
            </span>
            <span className="text-sm font-medium text-red-600">
              -{formatCurrency(discountAmountCalculated)}
            </span>
          </div>
        )}

        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-gray-900">Grand Total</span>
            <span className="text-base font-bold text-blue-600">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationSummary; 