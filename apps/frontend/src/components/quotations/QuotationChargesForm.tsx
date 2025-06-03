import React from 'react';
import { QuotationCharge } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2 } from 'lucide-react';

interface QuotationChargesFormProps {
  charges: QuotationCharge[];
  onChange: (charges: QuotationCharge[]) => void;
  readOnly?: boolean;
}

const QuotationChargesForm: React.FC<QuotationChargesFormProps> = ({
  charges,
  onChange,
  readOnly = false
}) => {
  const handleChargeChange = (index: number, field: keyof QuotationCharge, value: any) => {
    const updatedCharges = [...charges];
    updatedCharges[index] = { ...updatedCharges[index], [field]: value };
    onChange(updatedCharges);
  };

  const addCharge = () => {
    const newCharge: QuotationCharge = {
      description: '',
      amount: 0,
      isTax: false,
      isPredefined: false
    };
    onChange([...charges, newCharge]);
  };

  const removeCharge = (index: number) => {
    const updatedCharges = charges.filter((_, i) => i !== index);
    onChange(updatedCharges);
  };

  return (
    <div className="bg-white p-6 rounded-lg border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Additional Charges</h2>
        {!readOnly && (
          <Button
            type="button"
            onClick={addCharge}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Charge</span>
          </Button>
        )}
      </div>

      {charges.length === 0 && (
        <p className="text-gray-500 text-sm">No additional charges added.</p>
      )}

      {charges.length > 0 && (
        <div className="space-y-4">
          {charges.map((charge, index) => (
            <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                {readOnly ? (
                  <div className="py-2">{charge.description}</div>
                ) : (
                  <Input
                    type="text"
                    placeholder="Description"
                    value={charge.description}
                    onChange={(e) => handleChargeChange(index, 'description', e.target.value)}
                  />
                )}
              </div>
              
              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                {readOnly ? (
                  <div className="py-2">₹{charge.amount}</div>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={charge.amount}
                    onChange={(e) => handleChargeChange(index, 'amount', parseFloat(e.target.value) || 0)}
                  />
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {readOnly ? (
                  <div className="py-2">
                    {charge.isTax ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Tax</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Charge</span>
                    )}
                  </div>
                ) : (
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={charge.isTax || false}
                      onChange={(e) => handleChargeChange(index, 'isTax', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Tax</span>
                  </label>
                )}
              </div>
              
              {!readOnly && (
                <Button
                  type="button"
                  onClick={() => removeCharge(index)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuotationChargesForm; 