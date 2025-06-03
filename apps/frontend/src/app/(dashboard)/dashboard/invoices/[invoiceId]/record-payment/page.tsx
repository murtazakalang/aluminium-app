'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { invoiceApi, Invoice, PaymentFormData } from '@/lib/api/invoiceService';
import { ArrowLeft, CreditCard } from 'lucide-react';

export default function RecordPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<PaymentFormData>({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: 0,
    method: 'Bank Transfer',
    reference: ''
  });

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

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const response = await invoiceApi.getInvoice(invoiceId);
      setInvoice(response.data.invoice);
      // Set default amount to balance due
      setFormData(prev => ({
        ...prev,
        amount: response.data.invoice.balanceDue
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoice) return;
    
    // Validation
    if (formData.amount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }
    
    if (formData.amount > invoice.balanceDue) {
      setError('Payment amount cannot exceed the balance due');
      return;
    }
    
    if (!formData.method) {
      setError('Please select a payment method');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await invoiceApi.recordPayment(invoiceId, formData);
      
      // Redirect back to invoice detail page
      router.push(`/dashboard/invoices/${invoiceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof PaymentFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Invoice not found
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href={`/dashboard/invoices/${invoiceId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoice
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Record Payment</h1>
          <p className="text-gray-500 mt-1">
            Invoice {invoice.invoiceIdDisplay} - {invoice.clientSnapshot.clientName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Form */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Payment Details</h2>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={invoice.balanceDue}
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Maximum: {formatCurrency(invoice.balanceDue)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method *
                </label>
                <select
                  value={formData.method}
                  onChange={(e) => handleInputChange('method', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
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

              <div className="flex justify-end space-x-3 pt-6 border-t">
                <Link href={`/dashboard/invoices/${invoiceId}`}>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2"
                >
                  {submitting ? (
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
          </Card>
        </div>

        {/* Invoice Summary */}
        <div>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-medium">{invoice.invoiceIdDisplay}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Client:</span>
                <span className="font-medium">{invoice.clientSnapshot.clientName}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">{formatCurrency(invoice.grandTotal)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              
              <div className="border-t pt-3 flex justify-between">
                <span className="font-medium">Balance Due:</span>
                <span className="font-bold text-red-600">{formatCurrency(invoice.balanceDue)}</span>
              </div>

              {formData.amount > 0 && (
                <>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-blue-600">
                      <span className="font-medium">Payment Amount:</span>
                      <span className="font-bold">{formatCurrency(formData.amount)}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="font-medium">Remaining Balance:</span>
                      <span className={`font-bold ${
                        invoice.balanceDue - formData.amount <= 0 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {formatCurrency(Math.max(0, invoice.balanceDue - formData.amount))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Quick Amount Buttons */}
          <Card className="p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Amounts</h3>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => handleInputChange('amount', invoice.balanceDue)}
              >
                <span>Full Payment</span>
                <span>{formatCurrency(invoice.balanceDue)}</span>
              </Button>
              
              {invoice.balanceDue > 1000 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => handleInputChange('amount', Math.round(invoice.balanceDue / 2))}
                >
                  <span>Half Payment</span>
                  <span>{formatCurrency(Math.round(invoice.balanceDue / 2))}</span>
                </Button>
              )}
              
              {[1000, 5000, 10000].map((amount) => 
                amount < invoice.balanceDue && (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => handleInputChange('amount', amount)}
                  >
                    <span>₹{amount.toLocaleString()}</span>
                  </Button>
                )
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
} 