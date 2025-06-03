import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PaymentFormData } from '@/lib/api/invoiceService';
import { CreditCard, AlertCircle } from 'lucide-react';

interface PaymentFormProps {
  balanceDue: number;
  onSubmit: (data: PaymentFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function PaymentForm({ balanceDue, onSubmit, onCancel, loading }: PaymentFormProps) {
  const [formData, setFormData] = useState<PaymentFormData>({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: balanceDue,
    method: 'Bank Transfer',
    reference: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const paymentMethods = [
    'Bank Transfer',
    'Cash',
    'Cheque',
    'UPI',
    'Credit Card',
    'Debit Card',
    'Online Transfer',
    'Razorpay',
    'Other'
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    }

    if (formData.amount <= 0) {
      newErrors.amount = 'Payment amount must be greater than 0';
    }

    if (formData.amount > balanceDue) {
      newErrors.amount = 'Payment amount cannot exceed the balance due';
    }

    if (!formData.method) {
      newErrors.method = 'Payment method is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleInputChange = (field: keyof PaymentFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Record Payment</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Date *
          </label>
          <Input
            type="date"
            value={formData.paymentDate}
            onChange={(e) => handleInputChange('paymentDate', e.target.value)}
            className={errors.paymentDate ? 'border-red-300' : ''}
            required
          />
          {errors.paymentDate && (
            <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errors.paymentDate}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Amount *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={balanceDue}
            value={formData.amount}
            onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className={errors.amount ? 'border-red-300' : ''}
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Maximum: {formatCurrency(balanceDue)}
          </p>
          {errors.amount && (
            <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errors.amount}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Method *
        </label>
        <select
          value={formData.method}
          onChange={(e) => handleInputChange('method', e.target.value)}
          className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.method ? 'border-red-300' : 'border-gray-300'
          }`}
          required
        >
          {paymentMethods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        {errors.method && (
          <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {errors.method}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reference Number
        </label>
        <Input
          type="text"
          value={formData.reference}
          onChange={(e) => handleInputChange('reference', e.target.value)}
          placeholder="Transaction ID, Cheque Number, etc."
        />
        <p className="text-sm text-gray-500 mt-1">
          Optional: Any reference number or identifier for this payment
        </p>
      </div>

      {/* Quick Amount Buttons */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quick Amounts
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleInputChange('amount', balanceDue)}
          >
            Full Payment ({formatCurrency(balanceDue)})
          </Button>
          
          {balanceDue > 1000 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleInputChange('amount', Math.round(balanceDue / 2))}
            >
              Half Payment ({formatCurrency(Math.round(balanceDue / 2))})
            </Button>
          )}
          
          {[1000, 5000, 10000].map((amount) => 
            amount < balanceDue && (
              <Button
                key={amount}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleInputChange('amount', amount)}
              >
                ₹{amount.toLocaleString()}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Payment Preview */}
      {formData.amount > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Payment Preview</h4>
          <div className="space-y-1 text-sm text-blue-700">
            <div className="flex justify-between">
              <span>Payment Amount:</span>
              <span className="font-medium">{formatCurrency(formData.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining Balance:</span>
              <span className={`font-medium ${
                balanceDue - formData.amount <= 0 ? 'text-green-600' : 'text-orange-600'
              }`}>
                {formatCurrency(Math.max(0, balanceDue - formData.amount))}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Recording...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Record Payment
            </>
          )}
        </Button>
      </div>
    </form>
  );
} 