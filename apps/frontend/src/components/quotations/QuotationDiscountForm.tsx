import React from 'react';
import { QuotationDiscount } from '@/lib/types';
import { Input } from '@/components/ui/Input';

interface QuotationDiscountFormProps {
  discount: QuotationDiscount | undefined;
  onChange: (discount: QuotationDiscount) => void;
  readOnly?: boolean;
}

const QuotationDiscountForm: React.FC<QuotationDiscountFormProps> = ({
  discount,
  onChange,
  readOnly = false,
}) => {
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      type: e.target.value as 'fixed' | 'percentage',
      value: discount?.value || 0,
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      type: discount?.type || 'fixed',
      value: parseFloat(e.target.value) || 0,
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h2 className="text-lg font-semibold mb-4">Discount</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Discount Type
          </label>
          <select
            value={discount?.type || 'fixed'}
            onChange={handleTypeChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={readOnly}
          >
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Discount Value
          </label>
          <Input
            type="number"
            step="0.01"
            value={discount?.value || 0}
            onChange={handleValueChange}
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
};

export default QuotationDiscountForm; 