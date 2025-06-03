'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { invoiceApi, Invoice } from '@/lib/api/invoiceService';
import { ArrowLeft, Download, CreditCard, Eye, Clock, CheckCircle } from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const blob = await invoiceApi.getInvoicePdf(invoiceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice?.invoiceIdDisplay || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const statusColors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Sent': 'bg-blue-100 text-blue-800',
      'Partially Paid': 'bg-yellow-100 text-yellow-800',
      'Paid': 'bg-green-100 text-green-800',
      'Overdue': 'bg-red-100 text-red-800',
      'Void': 'bg-gray-100 text-gray-600'
    };
    
    return (
      <Badge className={statusColors[status]}>
        {status}
      </Badge>
    );
  };

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'Draft':
        return <Clock className="h-4 w-4" />;
      case 'Sent':
        return <Eye className="h-4 w-4" />;
      case 'Paid':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const parseNumericValue = (value: any): number => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'object' && value !== null && value.hasOwnProperty('$numberDecimal')) {
      return parseFloat(value.$numberDecimal);
    }
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return 0; // Default or throw error
  };

  const formatCurrency = (amount: any) => {
    const numericAmount = parseNumericValue(amount);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(numericAmount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  if (error || !invoice) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Invoice not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Invoice {invoice.invoiceIdDisplay}
            </h1>
            <p className="text-gray-500 mt-1">
              Created on {formatDate(invoice.invoiceDate)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {getStatusBadge(invoice.status)}
          <Button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          {invoice.balanceDue > 0 && (
            <Link href={`/dashboard/invoices/${invoiceId}/record-payment`}>
              <Button className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Record Payment
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Header Info */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Bill To</h3>
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">
                    {invoice.clientSnapshot.clientName}
                  </div>
                  {invoice.clientSnapshot.contactPerson && (
                    <div className="text-gray-600">
                      {invoice.clientSnapshot.contactPerson}
                    </div>
                  )}
                  <div className="text-gray-600">
                    {invoice.clientSnapshot.contactNumber}
                  </div>
                  {invoice.clientSnapshot.email && (
                    <div className="text-gray-600">
                      {invoice.clientSnapshot.email}
                    </div>
                  )}
                  {invoice.clientSnapshot.billingAddress && (
                    <div className="text-gray-600">
                      {invoice.clientSnapshot.billingAddress}
                    </div>
                  )}
                  {invoice.clientSnapshot.gstin && (
                    <div className="text-gray-600">
                      GSTIN: {invoice.clientSnapshot.gstin}
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Invoice Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Number:</span>
                    <span className="font-medium">{invoice.invoiceIdDisplay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Number:</span>
                    <span className="font-medium">{invoice.orderIdDisplaySnapshot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Date:</span>
                    <span className="font-medium">{formatDate(invoice.invoiceDate)}</span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Date:</span>
                      <span className="font-medium">{formatDate(invoice.dueDate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invoice.status)}
                      {getStatusBadge(invoice.status)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Invoice Items */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Product</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Dimensions</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Qty</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Area</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Rate</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.items.map((item, index) => {
                    const finalTotalChargeableArea = parseNumericValue(item.finalTotalChargeableArea);
                    const pricePerAreaUnit = parseNumericValue(item.pricePerAreaUnit);
                    const finalItemSubtotal = parseNumericValue(item.finalItemSubtotal);
                    const finalWidth = parseNumericValue(item.finalWidth);
                    const finalHeight = parseNumericValue(item.finalHeight);

                    return (
                      <tr key={item._id || index} className="border-b">
                        <td className="py-3 text-sm">
                          <div className="font-medium text-gray-900">{item.productTypeNameSnapshot}</div>
                          {item.itemLabel && <div className="text-xs text-gray-500">{item.itemLabel}</div>}
                        </td>
                        <td className="py-3 text-sm text-gray-600">
                          {finalWidth?.toFixed(2)} x {finalHeight?.toFixed(2)} {/* Units might need to be sourced differently */}
                        </td>
                        <td className="py-3 text-right text-sm text-gray-600">{item.finalQuantity}</td>
                        <td className="py-3 text-right text-sm text-gray-600">
                          {finalTotalChargeableArea?.toFixed(2)} {/* Area unit might need to be sourced differently */}
                        </td>
                        <td className="py-3 text-right text-sm text-gray-600">
                          {formatCurrency(pricePerAreaUnit)}
                        </td>
                        <td className="py-3 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(finalItemSubtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Charges and Total */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              
              {invoice.charges.map((charge, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{charge.description}:</span>
                  <span className="font-medium">{formatCurrency(charge.amount)}</span>
                </div>
              ))}
              
              {invoice.discount.value > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Discount ({invoice.discount.type === 'percentage' ? `${invoice.discount.value}%` : 'Fixed'}):
                  </span>
                  <span>-{formatCurrency(
                    invoice.discount.type === 'percentage' 
                      ? (invoice.subtotal * invoice.discount.value / 100)
                      : invoice.discount.value
                  )}</span>
                </div>
              )}
              
              <div className="border-t pt-2 flex justify-between text-lg font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(invoice.grandTotal)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">{formatCurrency(invoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">Balance Due:</span>
                <span className={`font-bold ${
                  invoice.balanceDue > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(invoice.balanceDue)}
                </span>
              </div>
            </div>
          </Card>

          {/* Payment History */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
            {invoice.payments.length === 0 ? (
              <p className="text-gray-500 text-sm">No payments recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {invoice.payments.map((payment, index) => (
                  <div key={index} className="border-b border-gray-100 pb-3 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(payment.amount)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(payment.paymentDate)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {payment.method}
                          {payment.reference && ` - ${payment.reference}`}
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">
                        #{index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </Card>
          )}

          {/* Terms & Conditions */}
          {invoice.termsAndConditions && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h3>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">
                {invoice.termsAndConditions}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 