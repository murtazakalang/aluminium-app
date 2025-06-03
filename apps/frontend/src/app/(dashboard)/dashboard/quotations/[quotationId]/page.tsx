'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { quotationApi } from '@/lib/api/quotationService';
import { orderApi } from '@/lib/api/orderService';
import { Quotation, Client, Staff, QuotationHistoryEntry } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Edit, Trash2, FileText, Send, Mail, MessageSquare, Download } from 'lucide-react';
import QuotationStatusBadge from '@/components/quotations/QuotationStatusBadge';
import QuotationSummary from '@/components/quotations/QuotationSummary';
import QuotationItemsTable from '@/components/quotations/QuotationItemsTable';
import QuotationSVGPreview from '@/components/quotations/QuotationSVGPreview';
import QuotationActions from '@/components/quotations/QuotationActions';
import { toast } from 'sonner';

// Helper function to safely convert Decimal128 or any value to a number
const convertDecimalToNumber = (value: any): number => {
  if (!value) return 0;
  
  // If it's a Decimal128 object with $numberDecimal property
  if (typeof value === 'object' && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal) || 0;
  }
  
  // If it's already a number
  if (typeof value === 'number') {
    return value;
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }
  
  return 0;
};

// Helper function to format decimal for display
const formatDecimalForDisplay = (value: any): string => {
  const numValue = convertDecimalToNumber(value);
  return numValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Helper function to format billing address
const formatAddress = (addressInput: any): string => {
  if (!addressInput) return '—';

  let address = addressInput;

  // Attempt to parse if it's a stringified JSON
  if (typeof addressInput === 'string') {
    try {
      const parsed = JSON.parse(addressInput);
      if (typeof parsed === 'object' && parsed !== null) {
        address = parsed;
      }
    } catch (e) {
      // Not a valid JSON string, treat as a plain string
    }
  }

  // If it's now an object with address fields, format it
  if (typeof address === 'object' && address !== null) {
    const parts = [];
    if (address.street) parts.push(address.street);
    else if (address.address) parts.push(address.address); // Alternative field name
    else if (address.line1) parts.push(address.line1); // Another common field
    
    if (address.line2) parts.push(address.line2);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.postalCode || address.zipCode || address.zip) {
      parts.push(address.postalCode || address.zipCode || address.zip);
    }
    if (address.country) parts.push(address.country);

    if (parts.length > 0) return parts.join(', ');
    
    // Fallback for unparseable objects: try to get a meaningful value
    const objectValues = Object.values(address).filter(val => typeof val === 'string' && val.trim() !== '');
    if (objectValues.length > 0) return objectValues.join(', ');

    return '—'; // Return '—' if object is empty or unparseable
  }
  
  // If it's a plain string after attempted parsing or was originally a string
  if (typeof address === 'string') {
    return address.trim() || '—';
  }
  
  return '—';
};

export default function QuotationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quotationIdFromParam = params.quotationId as string;
  
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [convertingToOrder, setConvertingToOrder] = useState(false);

  const getQuotationId = (): string => quotation?._id || quotationIdFromParam;

  const loadQuotation = async () => {
    try {
      setLoading(true);
      setError(null);
      const currentId = getQuotationId();
      const response = await quotationApi.getQuotation(currentId);
      const fetchedQuotation = response.data.quotation;

      const transformedQuotation: Quotation = {
        ...fetchedQuotation,
        clientId: fetchedQuotation.clientId as Client | string,
        createdBy: fetchedQuotation.createdBy as Staff | string,
        history: fetchedQuotation.history || [],
        minimumChargeableArea: convertDecimalToNumber(fetchedQuotation.minimumChargeableArea),
        items: fetchedQuotation.items.map((item: any) => ({
          ...item,
          width: convertDecimalToNumber(item.width),
          height: convertDecimalToNumber(item.height),
          pricePerAreaUnit: convertDecimalToNumber(item.pricePerAreaUnit),
          rawAreaPerItem: convertDecimalToNumber(item.rawAreaPerItem),
          convertedAreaPerItem: convertDecimalToNumber(item.convertedAreaPerItem),
          roundedAreaPerItem: convertDecimalToNumber(item.roundedAreaPerItem),
          chargeableAreaPerItem: convertDecimalToNumber(item.chargeableAreaPerItem),
          totalChargeableArea: convertDecimalToNumber(item.totalChargeableArea),
          itemSubtotal: convertDecimalToNumber(item.itemSubtotal),
          materialsSnapshot: (item.materialsSnapshot || []).map((snapshot: any) => ({
            ...snapshot,
            quantity: convertDecimalToNumber(snapshot.quantity),
          }))
        })),
        charges: (fetchedQuotation.charges || []).map((charge: any) => ({
          ...charge,
          amount: convertDecimalToNumber(charge.amount),
        })),
        discount: {
          type: fetchedQuotation.discount?.type || 'fixed',
          value: convertDecimalToNumber(fetchedQuotation.discount?.value),
        },
        subtotal: convertDecimalToNumber(fetchedQuotation.subtotal),
        totalCharges: convertDecimalToNumber(fetchedQuotation.totalCharges),
        discountAmount: convertDecimalToNumber(fetchedQuotation.discountAmount),
        totalTax: convertDecimalToNumber(fetchedQuotation.totalTax),
        grandTotal: convertDecimalToNumber(fetchedQuotation.grandTotal),
      };
      setQuotation(transformedQuotation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quotationIdFromParam) {
      loadQuotation();
    }
  }, [quotationIdFromParam]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!quotation) return;
    const currentId = getQuotationId();
    try {
      setUpdating(true);
      await quotationApi.updateStatus(currentId, newStatus);
      toast.success(`Quotation status updated to ${newStatus}`);
      await loadQuotation();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendQuotation = async () => {
    if (!quotation) return;
    const currentId = getQuotationId();
    try {
      setUpdating(true);
      await quotationApi.sendQuotation(currentId);
      toast.success('Quotation marked as Sent!');
      await loadQuotation();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send quotation';
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!quotation) return;
    const currentId = getQuotationId();
    toast.info('Generating PDF...');
    try {
      // Use the robust PDF utilities
      const { generateAndDownloadPDF, debugBlob } = await import('@/lib/utils/pdfUtils');
      
      await generateAndDownloadPDF(
        () => quotationApi.generatePDF(currentId),
        `quotation-${quotation.quotationIdDisplay}.pdf`
      );
      
      toast.success('PDF downloaded successfully!');
      
    } catch (err) {
      console.error('PDF Generation Error:', err);
      
      // Enhanced error handling
      if (err instanceof Error) {
        if (err.message.includes('Invalid PDF')) {
          toast.error('Server returned invalid PDF data. Please contact support.');
        } else if (err.message.includes('empty')) {
          toast.error('Generated PDF is empty. Please try again.');
        } else if (err.message.includes('authentication') || err.message.includes('logged in')) {
          toast.error('Please log in again to download PDF.');
        } else {
          toast.error(`PDF Error: ${err.message}`);
        }
      } else {
        toast.error('Failed to generate PDF. Please try again.');
      }
    }
  };

  const handleSendEmail = async () => {
    if (!quotation) return;
    const currentId = getQuotationId();
    const clientEmail = (typeof quotation.clientId === 'object' && quotation.clientId !== null) ? (quotation.clientId as Client).email : null;

    if (!clientEmail) {
      toast.error('Client email is not available.');
      return;
    }
    try {
      setEmailSending(true);
      const response = await quotationApi.sendQuotationByEmail(currentId);
      toast.success(response.message || 'Email sent successfully!');
      await loadQuotation();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send email';
      toast.error(errorMessage);
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!quotation) return;
    const clientData = (typeof quotation.clientId === 'object' && quotation.clientId !== null) ? (quotation.clientId as Client) : null;
    const clientContactNumber = clientData?.contactNumber;
    const clientName = clientData?.clientName || quotation.clientSnapshot?.clientName || 'Client';

    if (!clientContactNumber) {
      toast.error('Client contact number is not available.');
      return;
    }

    const rawPhoneNumber = clientContactNumber.replace(/\D/g, '');
    const phoneNumber = rawPhoneNumber.startsWith('91') ? rawPhoneNumber : `91${rawPhoneNumber}`;

    const pdfUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/quotations/${getQuotationId()}/pdf`;
    
    const companyName = (quotation as any).companyNameSnapshot || 'Our Company'; // Assuming companyNameSnapshot is available from backend or use placeholder

    const message = encodeURIComponent(
`Hello ${clientName},

Here is your quotation: ${quotation.quotationIdDisplay}
Download PDF: ${pdfUrl}

Let us know if you have any questions.

Regards,
${companyName}`
    );

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    toast.info('Opening WhatsApp...');
  };

  const handleConvertToOrder = async () => {
    if (!quotation) return;
    
    if (!confirm('Are you sure you want to convert this quotation to an order?')) return;
    
    setConvertingToOrder(true);
    setError(null);
    try {
      const response = await orderApi.createFromQuotation(quotation._id);
      if (response && response.data && response.data.order && response.data.order._id) {
        toast.success('Quotation successfully converted to order!');
        // Refresh quotation data to show updated status
        await loadQuotation();
        // Redirect to the new order
        router.push(`/dashboard/orders/${response.data.order._id}`);
      } else {
        throw new Error('Failed to get order details from conversion response.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert quotation to order';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setConvertingToOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Button onClick={() => router.back()} variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quotations
        </Button>
        <div className="text-red-500 bg-red-100 p-4 rounded-md">Error: {error}</div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-6">
        <Button onClick={() => router.back()} variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quotations
        </Button>
        <div>Quotation not found.</div>
      </div>
    );
  }

  const finalStatuses = ['Accepted', 'Rejected', 'Converted', 'Expired'];
  const canEdit = !finalStatuses.includes(quotation.status);
  const canSend = quotation.status === 'Draft';
  
  // Explicitly check if clientId is a populated Client object
  const clientDetails = (typeof quotation.clientId === 'object' && quotation.clientId !== null) ? (quotation.clientId as Client) : null;
  const hasClientEmail = !!clientDetails?.email;
  const hasClientPhone = !!clientDetails?.contactNumber;

  const createdByStaff = typeof quotation.createdBy === 'object' ? quotation.createdBy as Staff : null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Button onClick={() => router.push('/dashboard/quotations')} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
        </Button>
        <h1 className="text-2xl font-bold text-gray-800">Quotation Details</h1>
        <QuotationStatusBadge status={quotation.status} />
      </div>

      <div className="bg-white p-4 shadow rounded-lg">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 items-center">
          {quotation && (
            <QuotationActions
              quotation={quotation}
              updating={updating || emailSending || convertingToOrder}
              onSend={handleSendQuotation}
              onStatusUpdate={handleStatusUpdate}
              onGeneratePDF={handleGeneratePDF}
            />
          )}
          
          <Button 
            onClick={handleSendEmail} 
            variant="outline"
            className="bg-green-500 hover:bg-green-600 text-white"
            disabled={!hasClientEmail || updating || emailSending || convertingToOrder}
            title={!hasClientEmail ? 'Client email not available' : 'Send quotation via Email'}
          >
            {emailSending ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <><Mail className="mr-2 h-4 w-4" /> Email PDF</>
            )}
          </Button>

          <Button 
            onClick={handleSendWhatsApp} 
            variant="outline" 
            className="bg-teal-500 hover:bg-teal-600 text-white"
            disabled={!hasClientPhone || updating || emailSending || convertingToOrder}
            title={!hasClientPhone ? 'Client phone number not available' : 'Send quotation via WhatsApp'}
          >
            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
          </Button>

          {quotation.status === 'Accepted' && (
            <Button
              onClick={handleConvertToOrder}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={convertingToOrder || updating || emailSending}
            >
              {convertingToOrder ? 'Converting...' : 'Convert to Order'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white p-6 shadow rounded-lg">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-gray-700">Client Information</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Name:</strong> {clientDetails?.clientName || quotation.clientSnapshot?.clientName || 'N/A'}</p>
            <p><strong>Email:</strong> {clientDetails?.email || 'N/A'}</p>
            <p><strong>Phone:</strong> {clientDetails?.contactNumber || 'N/A'}</p>
            <p><strong>Billing Address:</strong> {formatAddress(clientDetails?.billingAddress || quotation.clientSnapshot?.billingAddress)}</p>
            <p><strong>Site Address:</strong> {formatAddress(clientDetails?.siteAddress || quotation.clientSnapshot?.siteAddress)}</p>
            <p><strong>GSTIN:</strong> {clientDetails?.gstin || quotation.clientSnapshot?.gstin || 'N/A'}</p>
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-6 shadow rounded-lg">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-gray-700">Quotation Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Quote ID</p>
              <p className="font-semibold text-gray-700">{quotation.quotationIdDisplay}</p>
            </div>
            <div>
              <p className="text-gray-500">Created Date</p>
              <p className="font-semibold text-gray-700">{new Date(quotation.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Valid Until</p>
              <p className="font-semibold text-gray-700">
                {quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Created By</p>
              <p className="font-semibold text-gray-700">
                {createdByStaff ? `${createdByStaff.firstName || ''} ${createdByStaff.lastName || ''}`.trim() : 'System'}
              </p>
            </div>
             <div>
              <p className="text-gray-500">Dimension Unit</p>
              <p className="font-semibold text-gray-700">{quotation.dimensionUnit}</p>
            </div>
            <div>
              <p className="text-gray-500">Area Unit</p>
              <p className="font-semibold text-gray-700">{quotation.areaUnit}</p>
            </div>
          </div>
          {quotation.notes && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold text-gray-700 mb-1">Notes:</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 shadow rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Items</h2>
        <QuotationItemsTable 
          items={quotation.items} 
          dimensionUnit={quotation.dimensionUnit} 
          areaUnit={quotation.areaUnit} 
        />
      </div>
      
      <QuotationSummary 
        subtotal={quotation.subtotal}
        charges={quotation.charges}
        totalChargesAmount={quotation.totalCharges}
        discount={quotation.discount}
        discountAmountCalculated={quotation.discountAmount}
        grandTotal={quotation.grandTotal}
        showDetails={true}
      />

      {quotation.history && quotation.history.length > 0 && (
        <div className="bg-white p-6 shadow rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Quotation History</h2>
          <ul className="space-y-3">
            {quotation.history.slice().reverse().map((entry: QuotationHistoryEntry, index: number) => (
              <li key={index} className="text-sm p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className={`font-medium ${entry.status === 'Draft' ? 'text-yellow-600' : entry.status === 'Sent' ? 'text-blue-600' : entry.status === 'Accepted' ? 'text-green-600' : 'text-gray-700'}`}>Status: {entry.status}</span>
                  <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                {entry.notes && <p className="text-gray-600 mt-1">Notes: {entry.notes}</p>}
                {typeof entry.updatedBy === 'object' && entry.updatedBy && (
                  <p className="text-xs text-gray-400 mt-0.5">By: {entry.updatedBy.firstName} {entry.updatedBy.lastName}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
} 