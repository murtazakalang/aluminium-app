'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { quotationApi } from '@/lib/api/quotationService';
import { clientApi } from '@/lib/api';
import { QuotationFormData, Client } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import QuotationItemForm from '@/components/quotations/QuotationItemForm';
import QuotationChargesForm from '@/components/quotations/QuotationChargesForm';
import QuotationDiscountForm from '@/components/quotations/QuotationDiscountForm';
import { ArrowLeft } from 'lucide-react';
import QuotationSummary from '@/components/quotations/QuotationSummary';
import { calculateItemDetailsFrontend, calculateQuotationTotalsFrontend } from '@/lib/utils/quotationCalculatorFrontend';
import { useUnits } from '@/contexts/UnitContext';
import { FiSettings } from 'react-icons/fi';

export default function NewQuotationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const { getDefaultDimensionUnit, getDefaultAreaUnit, dimensionUnit, areaUnit, isUnitLoading } = useUnits();
  
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

  // Load clients on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const clientsResponse = await clientApi.listClients({ limit: 100 });
        setClients(clientsResponse.data);
      } catch (error) {
      }
    };
    loadData();
  }, []);

  // Recalculate preview totals when formData changes
  useEffect(() => {
    const itemsWithPreviewSubtotals = formData.items.map(item => {
      const details = calculateItemDetailsFrontend(
        item, 
        getDefaultDimensionUnit(), // Use global dimension unit setting
        getDefaultAreaUnit(),      // Use global area unit setting
        true      // applyMinimum: true for previews to be consistent with saved values
      );
      return { ...item, itemSubtotal: details.itemSubtotal }; // Add calculated subtotal for total calculation
    });

    const totals = calculateQuotationTotalsFrontend(
      itemsWithPreviewSubtotals,
      formData.charges,
      formData.discount
    );
    setPreviewTotals(totals);
  }, [formData.items, formData.charges, formData.discount, getDefaultDimensionUnit, getDefaultAreaUnit]);

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
      setLoading(true);
      const response = await quotationApi.createQuotation(formData);
      router.push(`/dashboard/quotations/${response.data.quotation._id}`);
    } catch (error) {
      alert('Failed to create quotation');
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof QuotationFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <Button
          onClick={() => router.back()}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Quotation</h1>
          <p className="text-gray-600">Fill in the details to create a new quotation with automatic unit configuration</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Selection */}
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
              />
            </div>
          </div>
          
          {/* Unit Configuration Display */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dimension Unit
                <span className="ml-1 text-gray-500 text-xs">(Auto-configured)</span>
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                  {isUnitLoading ? 'Loading...' : `${dimensionUnit} (from General Settings)`}
                </div>
                <div className="text-xs text-gray-500">
                  <FiSettings size={16} className="inline mr-1" />
                  Auto
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Dimension unit for width and height inputs, automatically set from your General Settings
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Area Unit
                <span className="ml-1 text-gray-500 text-xs">(Auto-configured)</span>
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                  {isUnitLoading ? 'Loading...' : `${areaUnit} (from General Settings)`}
                </div>
                <div className="text-xs text-gray-500">
                  <FiSettings size={16} className="inline mr-1" />
                  Auto
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Area unit for calculations and pricing, automatically set from your General Settings
              </p>
            </div>
          </div>
        </div>
        
        {/* Unit Settings Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <FiSettings className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Automatic Unit Configuration
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  This quotation will automatically use your current General Settings for units:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><strong>Dimension Unit:</strong> {dimensionUnit} (for width/height inputs)</li>
                  <li><strong>Area Unit:</strong> {areaUnit} (for area calculations and pricing)</li>
                </ul>
                <p className="mt-2 text-xs">
                  Change these defaults in Settings → General → Unit Settings to affect all new quotations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <QuotationItemForm
          items={formData.items}
          onChange={(items) => handleInputChange('items', items)}
          dimensionUnit={getDefaultDimensionUnit()}
          areaUnit={getDefaultAreaUnit()}
        />

        {/* Additional Charges */}
        <QuotationChargesForm
          charges={formData.charges || []}
          onChange={(charges) => handleInputChange('charges', charges)}
        />

        {/* Discount Form */}
        <QuotationDiscountForm 
          discount={formData.discount}
          onChange={(discount) => handleInputChange('discount', discount)}
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
            Subtotal, charges, discount, and grand total will be calculated and shown after the quotation is created.
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            onClick={() => router.back()}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Quotation'}
          </Button>
        </div>
      </form>
    </div>
  );
} 