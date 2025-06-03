'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { quotationApi } from '@/lib/api/quotationService';
import { clientApi, productApi } from '@/lib/api';
import { QuotationFormData, Client, Quotation, QuotationItem, QuotationCharge } from '@/lib/types';
import { ProductType } from '@/lib/api/productService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft } from 'lucide-react';
import QuotationItemForm from '@/components/quotations/QuotationItemForm';
import QuotationChargesForm from '@/components/quotations/QuotationChargesForm';
import QuotationDiscountForm from '@/components/quotations/QuotationDiscountForm';
import QuotationSummary from '@/components/quotations/QuotationSummary';
import { calculateItemDetailsFrontend, calculateQuotationTotalsFrontend } from '@/lib/utils/quotationCalculatorFrontend';
import { useUnits } from '@/contexts/UnitContext';
import { FiSettings, FiInfo } from 'react-icons/fi';

// Helper function to safely convert Decimal128 or any value to a number
const safeParseFloat = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value === 'object' && value !== null && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal) || 0;
  }
  return 0;
};

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const quotationId = params.quotationId as string;
  const { dimensionUnit, areaUnit } = useUnits();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [originalQuotation, setOriginalQuotation] = useState<Quotation | null>(null);
  const [formData, setFormData] = useState<QuotationFormData>({
    clientId: '',
    items: [{
      productTypeId: '',
      width: 0,
      height: 0,
      quantity: 1,
      itemLabel: '',
      pricePerAreaUnit: 0
    }],
    charges: [],
    discount: { type: 'fixed', value: 0 },
    notes: '',
    validUntil: ''
  });

  // State for preview totals
  const [previewTotals, setPreviewTotals] = useState({
    subtotal: 0,
    totalChargesAmount: 0,
    discountAmount: 0,
    grandTotal: 0,
  });

  // Load quotation and clients data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load quotation
        const quotationResponse = await quotationApi.getQuotation(quotationId);
        const quotation = quotationResponse.data.quotation;
        setOriginalQuotation(quotation);
        
        // Check if quotation can be edited - allow Draft and Sent, prevent final statuses
        const finalStatuses = ['Accepted', 'Rejected', 'Converted', 'Expired'];
        if (finalStatuses.includes(quotation.status)) {
          alert(`Cannot edit quotation with status '${quotation.status}'. Only Draft and Sent quotations can be edited.`);
          router.push(`/dashboard/quotations/${quotationId}`);
          return;
        }
        
        // Load clients
        const clientsResponse = await clientApi.listClients({ limit: 100 });
        setClients(clientsResponse.data);
        
        // Load product types
        const productTypesResponse = await productApi.getProducts();
        setProductTypes(productTypesResponse);
        
        // Populate form with existing data
        setFormData({
          clientId: typeof quotation.clientId === 'string' ? quotation.clientId : (quotation.clientId as any)?._id || '',
          items: quotation.items.map((item: any) => ({
            productTypeId: typeof item.productTypeId === 'object' && item.productTypeId?._id 
                            ? item.productTypeId._id.toString() 
                            : item.productTypeId?.toString() || '',
            productTypeNameSnapshot: typeof item.productTypeId === 'object' && item.productTypeId?.name 
                                     ? item.productTypeId.name 
                                     : item.productTypeNameSnapshot,
            width: safeParseFloat(item.width),
            height: safeParseFloat(item.height),
            quantity: item.quantity,
            itemLabel: item.itemLabel || '',
            pricePerAreaUnit: safeParseFloat(item.pricePerAreaUnit),
            selectedGlassTypeId: item.selectedGlassTypeId || undefined,
            selectedGlassTypeNameSnapshot: item.selectedGlassTypeNameSnapshot || undefined,
            frameColour: item.frameColour || undefined
          })),
          charges: quotation.charges?.map((charge: any) => ({
            description: charge.description,
            amount: safeParseFloat(charge.amount),
            isTax: charge.isTax || false,
            isPredefined: charge.isPredefined || false
          })) || [],
          discount: {
            type: quotation.discount?.type || 'fixed',
            value: safeParseFloat(quotation.discount?.value)
          },
          notes: quotation.notes || '',
          validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().split('T')[0] : ''
        });
        
        // Initial calculation of preview totals based on loaded formData
        // This ensures summary is shown correctly on first load after fetching
        const initialItemsWithPreviewSubtotals = (quotation.items || []).map((item: any) => {
          const details = calculateItemDetailsFrontend(
            { 
              width: safeParseFloat(item.width),
              height: safeParseFloat(item.height),
              quantity: item.quantity,
              pricePerAreaUnit: safeParseFloat(item.pricePerAreaUnit)
            },
            quotation.dimensionUnit || 'inches',
            quotation.areaUnit || 'sqft',
            true
          );
          return { ...item, itemSubtotal: details.itemSubtotal };
        });
        const initialTotals = calculateQuotationTotalsFrontend(
          initialItemsWithPreviewSubtotals,
          (quotation.charges || []).map((charge: any) => ({...charge, amount: safeParseFloat(charge.amount)})),
          quotation.discount ? { type: quotation.discount.type, value: safeParseFloat(quotation.discount.value) } : undefined
        );
        setPreviewTotals(initialTotals);

      } catch (error) {
        alert('Failed to load quotation data');
        router.push('/dashboard/quotations');
      } finally {
        setLoading(false);
      }
    };
    
    if (quotationId) {
      loadData();
    }
  }, [quotationId, router]);

  // Recalculate preview totals when formData changes
  useEffect(() => {
    if (!originalQuotation) return; // Don't calculate if original data isn't loaded yet

    const itemsWithPreviewSubtotals = formData.items.map(item => {
      const details = calculateItemDetailsFrontend(
        item, // formData.items already have numeric width, height, pricePerAreaUnit due to safeParseFloat on load
        originalQuotation.dimensionUnit || 'inches', // Use original quotation's units for consistency in preview
        originalQuotation.areaUnit || 'sqft',
        true
      );
      return { ...item, itemSubtotal: details.itemSubtotal };
    });

    const totals = calculateQuotationTotalsFrontend(
      itemsWithPreviewSubtotals,
      formData.charges,
      formData.discount
    );
    setPreviewTotals(totals);
  }, [formData.items, formData.charges, formData.discount, originalQuotation]); // Recalculate when form or originalQuotation (for units/rules) changes

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId) {
      alert('Please select a client');
      return;
    }

    if (formData.items.length === 0 || !formData.items[0].productTypeId) {
      alert('Please add at least one item');
      return;
    }

    try {
      setSaving(true);
      await quotationApi.updateQuotation(quotationId, formData);
      router.push(`/dashboard/quotations/${quotationId}`);
    } catch (error) {
      alert('Failed to update quotation');
    } finally {
      setSaving(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof QuotationFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <Button
          onClick={() => router.push(`/dashboard/quotations/${quotationId}`)}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Quotation {originalQuotation?.quotationIdDisplay}
          </h1>
          <p className="text-gray-600">Update the quotation details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Information and Valid Until */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Client Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client *
              </label>
              <select
                value={formData.clientId}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={saving}
              >
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.clientName} - {client.contactNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valid Until
              </label>
              <Input
                type="date"
                value={formData.validUntil}
                onChange={(e) => handleInputChange('validUntil', e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          
          {/* Unit Configuration Display (Locked for existing quotations) */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dimension Unit
                <span className="ml-1 text-gray-500 text-xs">(Locked for existing quotation)</span>
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                  {originalQuotation?.dimensionUnit || 'inches'}
                </div>
                <div className="text-xs text-gray-500">
                  <FiInfo size={16} className="inline mr-1" />
                  Locked
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                The dimension unit cannot be changed for existing quotations to maintain data consistency.
                Current global setting: {dimensionUnit}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area Unit
                <span className="ml-1 text-gray-500 text-xs">(Locked for existing quotation)</span>
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                  {originalQuotation?.areaUnit || 'sqft'}
                </div>
                <div className="text-xs text-gray-500">
                  <FiInfo size={16} className="inline mr-1" />
                  Locked
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                The area unit cannot be changed for existing quotations to maintain data consistency.
                Current global setting: {areaUnit}
              </p>
            </div>
          </div>
        </div>
        
        {/* Unit Settings Notice Panel (only show if units differ from current settings) */}
        {originalQuotation && (originalQuotation.dimensionUnit !== dimensionUnit || originalQuotation.areaUnit !== areaUnit) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <FiInfo className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Unit Settings Notice
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    This quotation uses different units than your current General Settings:
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {originalQuotation.dimensionUnit !== dimensionUnit && (
                      <li><strong>Dimension Unit:</strong> This quotation uses <strong>{originalQuotation.dimensionUnit}</strong>, current setting is <strong>{dimensionUnit}</strong></li>
                    )}
                    {originalQuotation.areaUnit !== areaUnit && (
                      <li><strong>Area Unit:</strong> This quotation uses <strong>{originalQuotation.areaUnit}</strong>, current setting is <strong>{areaUnit}</strong></li>
                    )}
                  </ul>
                  <p className="mt-2 text-xs">
                    New quotations will use your current settings: {dimensionUnit} and {areaUnit}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items */}
        <QuotationItemForm
          items={formData.items}
          onChange={(items: QuotationItem[]) => handleInputChange('items', items)}
          dimensionUnit={originalQuotation?.dimensionUnit || 'inches'}
          areaUnit={originalQuotation?.areaUnit || 'sqft'}
          readOnly={saving}
        />

        {/* Additional Charges */}
        <QuotationChargesForm
          charges={formData.charges || []}
          onChange={(charges: QuotationCharge[]) => handleInputChange('charges', charges)}
          readOnly={saving}
        />

        {/* Discount Form */}
        <QuotationDiscountForm 
          discount={formData.discount}
          onChange={(discount) => handleInputChange('discount', discount)}
          readOnly={saving}
        />

        {/* Notes */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Notes</h2>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Add any additional notes or comments..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={saving}
          />
        </div>

        {/* Quotation Summary with preview data */}
        <QuotationSummary 
          subtotal={previewTotals.subtotal}
          charges={formData.charges?.map(charge => ({
            ...charge,
            amount: Number(charge.amount) || 0
          }))}
          totalChargesAmount={previewTotals.totalChargesAmount}
          discount={formData.discount ? {
            type: formData.discount.type,
            value: Number(formData.discount.value) || 0
          } : undefined}
          discountAmountCalculated={previewTotals.discountAmount}
          grandTotal={previewTotals.grandTotal}
          showDetails={true}
        />

        <div className="bg-white p-6 rounded-lg border">
          <p className="text-sm text-gray-600">
            Any changes to items, charges, or discount will be reflected in the totals after saving.
            The updated summary will be visible on the quotation view page.
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            onClick={() => router.push(`/dashboard/quotations/${quotationId}`)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
} 