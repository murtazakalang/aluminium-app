'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    estimationApi,
    Estimation,
    ManualCharge,
    CalculatedMaterial,
    EstimationUpdateData
} from '@/lib/api/estimationService';
import MaterialCostingTable from '@/components/estimations/MaterialCostingTable';
import ManualChargesForm from '@/components/estimations/ManualChargesForm';
import { toast } from 'sonner';

// Helper for safe parsing and calculation, can be moved to a util file
const safeParseFloat = (value: any, defaultValue = 0): number => {
  if (value === null || value === undefined) return defaultValue;
  let numValue = parseFloat(typeof value === 'object' && value.$numberDecimal !== undefined ? value.$numberDecimal : value.toString());
  return isNaN(numValue) ? defaultValue : numValue;
};

const calculateCosts = (materials: CalculatedMaterial[], manualCharges: ManualCharge[], markupPerc: string) => {
  let subtotalMaterials = 0;
  materials.forEach(mat => {
    subtotalMaterials += safeParseFloat(mat.calculatedCost);
  });

  let subtotalManualCharges = 0;
  manualCharges.forEach(charge => {
    subtotalManualCharges += safeParseFloat(charge.amount);
  });

  const totalEstimatedCost = subtotalMaterials + subtotalManualCharges;
  const markup = safeParseFloat(markupPerc) / 100;
  const markedUpTotal = totalEstimatedCost * (1 + markup);

  return {
    subtotalMaterials: subtotalMaterials.toFixed(2),
    subtotalManualCharges: subtotalManualCharges.toFixed(2),
    totalEstimatedCost: totalEstimatedCost.toFixed(2),
    markedUpTotal: markedUpTotal.toFixed(2),
  };
};

interface PageProps {
  params: {
    estimationId: string;
  };
}

export default function CalculateEstimationPage({ params }: PageProps) {
  const router = useRouter();
  const { estimationId } = params;
  
  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [convertingToQuote, setConvertingToQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markupPercentage, setMarkupPercentage] = useState('0');
  
  // Derived state for summary, calculated on the frontend for immediate feedback
  const [frontendCalculatedSummary, setFrontendCalculatedSummary] = useState({
    subtotalMaterials: '0.00',
    subtotalManualCharges: '0.00',
    totalEstimatedCost: '0.00',
    markedUpTotal: '0.00',
  });

  // Fetch estimation data
  useEffect(() => {
    const fetchEstimation = async () => {
      try {
        setLoading(true);
        const data = await estimationApi.getEstimation(estimationId);
        setEstimation(data);
        setMarkupPercentage(data.markupPercentage ? data.markupPercentage.toString() : '0');
        // Initialize frontend summary from fetched data
        if (data) {
            const summary = calculateCosts(data.calculatedMaterials || [], data.manualCharges || [], data.markupPercentage ? data.markupPercentage.toString() : '0');
            setFrontendCalculatedSummary(summary);
        }
      } catch (err) {
        setError('Failed to load estimation');
      } finally {
        setLoading(false);
      }
    };

    fetchEstimation();
  }, [estimationId]);

  // Recalculate frontend summary whenever relevant parts of estimation change
  const recalculateFrontendSummary = useCallback(() => {
    if (!estimation) return;
    const summary = calculateCosts(
      estimation.calculatedMaterials || [], 
      estimation.manualCharges || [], 
      markupPercentage
    );
    setFrontendCalculatedSummary(summary);
  }, [estimation, markupPercentage]);

  useEffect(() => {
    recalculateFrontendSummary();
  }, [estimation, markupPercentage, recalculateFrontendSummary]);

  // Calculate materials
  const handleCalculate = async () => {
    try {
      setCalculating(true);
      setError(null);
      
      const calculatedEstimation = await estimationApi.calculateMaterials(estimationId);
      setEstimation(calculatedEstimation);
      
    } catch (err) {
      setError('Failed to calculate materials');
    } finally {
      setCalculating(false);
    }
  };

  // Handle manual unit rate changes
  const handleMaterialRateChange = (materialId: string, newRateString: string) => {
    // Ensure the input is a valid numeric string
    const validRateString = newRateString.replace(/[^0-9.]/g, '');
    
    setEstimation(prev => {
      if (!prev) return prev;
      
      const updatedMaterials = prev.calculatedMaterials?.map(material => {
        if (material.materialId === materialId) {
          return {
            ...material,
            manualUnitRate: validRateString
          };
        }
        return material;
      });
      
      return {
        ...prev,
        calculatedMaterials: updatedMaterials
      };
    });
  };

  // Update estimation data (manual rates, charges, markup)
  const handleSave = async () => {
    if (!estimation?.calculatedMaterials) return;
    
    try {
      setSaving(true);
      setError(null);
      
      let clientIdToSend: string | undefined = undefined;
      if (estimation.clientId) {
        if (typeof estimation.clientId === 'string') {
          clientIdToSend = estimation.clientId;
        } else if (typeof estimation.clientId === 'object' && estimation.clientId._id) {
          clientIdToSend = estimation.clientId._id.toString(); // Ensure it's a string
        }
      }

      const updatePayload: EstimationUpdateData = {
        projectName: estimation.projectName,
        clientId: clientIdToSend,
        dimensionUnitUsed: estimation.dimensionUnitUsed,
        items: estimation.items.map(item => ({
            ...item,
            width: safeParseFloat(item.width),
            height: safeParseFloat(item.height),
        })),
        calculatedMaterials: estimation.calculatedMaterials.map(material => ({
            ...material,
            totalQuantity: material.totalQuantity ? material.totalQuantity.toString() : '0',
            manualUnitRate: material.manualUnitRate ? material.manualUnitRate.toString() : '0.00',
            calculatedCost: material.calculatedCost ? material.calculatedCost.toString() : '0.00',
            // Ensure all relevant fields that might be Decimal128 are stringified
            totalWeight: material.totalWeight ? material.totalWeight.toString() : '0.000',
            autoUnitRate: material.autoUnitRate ? material.autoUnitRate.toString() : '0.00',
            pipeBreakdown: material.pipeBreakdown ? material.pipeBreakdown.map(pb => ({
                ...pb,
                length: typeof pb.length === 'object' && pb.length.$numberDecimal ? pb.length.$numberDecimal : (pb.length || '0').toString(),
            })) : [],
        })),
        manualCharges: estimation.manualCharges.map(charge => ({
            ...charge,
            amount: charge.amount ? charge.amount.toString() : '0.00', 
        })),
        markupPercentage: markupPercentage ? markupPercentage.toString() : '0.00'
      };

      const updatedEstimationResult = await estimationApi.updateEstimation(estimationId, updatePayload);
      
      setEstimation(updatedEstimationResult.estimation);
      setMarkupPercentage(updatedEstimationResult.estimation.markupPercentage ? updatedEstimationResult.estimation.markupPercentage.toString() : '0');
      toast.success('Material rates saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
      toast.error('Failed to save material rates');
    } finally {
      setSaving(false);
    }
  };

  // Generate PDF
  const handleGeneratePDF = async () => {
    try {
      const { generateAndDownloadPDF } = await import('@/lib/utils/pdfUtils');
      
      await generateAndDownloadPDF(
        () => estimationApi.generatePDF(estimationId),
        `estimation-${estimation?.projectName?.replace(/\s+/g, '-') || 'estimation'}.pdf`
      );
    } catch (err) {
      setError('Failed to generate PDF');
    }
  };

  // Handle manual charges changes
  const handleManualChargesChange = (charges: ManualCharge[]) => {
    if (!estimation) return;
    // Ensure amounts in charges are strings for consistency with backend and pre-save hook
    const sanitizedCharges = charges.map(charge => ({
        ...charge,
        amount: safeParseFloat(charge.amount).toFixed(2)
    }));
    setEstimation(prevEstimation => prevEstimation ? { ...prevEstimation, manualCharges: sanitizedCharges } : null);
    // Recalculation of summary will be triggered by useEffect watching `estimation`
  };

  const handleMarkupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMarkup = e.target.value;
    // Allow only numbers and a single decimal point for markup input
    if (/^\d*\.?\d*$/.test(newMarkup)) {
        setMarkupPercentage(newMarkup);
    }
    // Recalculation of summary will be triggered by useEffect watching `markupPercentage`
  };

  // Convert to quotation handler
  const handleConvertToQuotation = async () => {
    if (!estimationId) return;
    setConvertingToQuote(true);
    try {
      const response = await estimationApi.convertToQuotation(estimationId);
      toast.success('Estimation Converted', {
        description: `Successfully converted to Quotation ID: ${response.quotationId}`,
        action: {
          label: 'View Quotation',
          onClick: () => router.push(`/dashboard/quotations/${response.quotationId}/edit`),
        },
      });
      // Refresh estimation data to show updated status
      const data = await estimationApi.getEstimation(estimationId);
      setEstimation(data);
      // Redirect to quotation edit page after a short delay
      setTimeout(() => {
        router.push(`/dashboard/quotations/${response.quotationId}/edit`);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert to quotation.';
      setError(errorMessage);
      toast.error('Conversion Failed', { description: errorMessage });
    } finally {
      setConvertingToQuote(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-10">
          <p className="text-gray-500">Loading estimation...</p>
        </div>
      </div>
    );
  }

  if (!estimation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Estimation not found
        </div>
        <button
          onClick={() => router.push('/dashboard/estimations')}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
        >
          Back to Estimations
        </button>
      </div>
    );
  }

  const needsCalculation = estimation.status === 'Draft' || 
    (estimation.status !== 'Calculated' && (!estimation.calculatedMaterials || estimation.calculatedMaterials.length === 0));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{estimation.projectName}</h1>
          <p className="text-gray-600 mt-1">
            Status: <span className="font-medium">{estimation.status}</span>
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/estimations/${estimationId}/edit`)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded"
          >
            Edit Details
          </button>
          {estimation.status === 'Calculated' && (
            <button
              type="button"
              onClick={handleConvertToQuotation}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
              disabled={convertingToQuote}
            >
              {convertingToQuote ? 'Converting...' : 'Convert to Quotation'}
            </button>
          )}
          <button
            type="button"
            onClick={handleGeneratePDF}
            className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
            disabled={needsCalculation}
          >
            Generate PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {needsCalculation ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                This estimation needs to be calculated. Click the "Calculate Materials" button below to proceed.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        {needsCalculation ? (
          <div className="text-center py-10">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={calculating}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${calculating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {calculating ? 'Calculating...' : 'Calculate Materials'}
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Required Materials</h3>
                <p className="mt-1 text-sm text-gray-500">Material quantities and costs calculated from the estimation items.</p>
              </div>
              <div className="px-4 pb-5 sm:px-6">
                {estimation.calculatedMaterials && estimation.calculatedMaterials.length > 0 ? (
                  <MaterialCostingTable 
                    materials={estimation.calculatedMaterials}
                    onRateChange={handleMaterialRateChange}
                    readOnly={false}
                  />
                ) : (
                  <div className="bg-orange-50 border border-orange-200 p-4 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-orange-800">No Materials Found</h3>
                        <div className="mt-2 text-sm text-orange-700">
                          <p>The calculation completed successfully, but no materials were found. This usually happens when:</p>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Product types are missing material links (formulas)</li>
                            <li>Materials referenced in formulas no longer exist or are inactive</li>
                            <li>Product configurations are incomplete</li>
                          </ul>
                          <p className="mt-2">
                            Please check the product configurations in the <strong>Products</strong> section to ensure all materials are properly linked.
                          </p>
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={handleCalculate}
                              disabled={calculating}
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${calculating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {calculating ? 'Recalculating...' : 'Recalculate Materials'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <ManualChargesForm
                  charges={estimation.manualCharges || []}
                  onChange={handleManualChargesChange}
                  readOnly={false}
                />
              </div>

              <div className="bg-white p-4 rounded-md shadow">
                <h3 className="text-lg font-medium mb-4">Cost Summary</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal (Materials):</span>
                    <span className="font-medium">{frontendCalculatedSummary.subtotalMaterials}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal (Manual Charges):</span>
                    <span className="font-medium">{frontendCalculatedSummary.subtotalManualCharges}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-gray-700">Total Estimated Cost:</span>
                    <span>{frontendCalculatedSummary.totalEstimatedCost}</span>
                  </div>
                  <hr className="my-3"/>
                  <div className="flex items-center justify-between">
                    <label htmlFor="markup" className="text-gray-600">Markup (%):</label>
                    <input 
                      id="markup"
                      type="text" // Changed to text to allow direct string manipulation via regex
                      value={markupPercentage}
                      onChange={handleMarkupChange}
                      className="w-24 p-2 text-right border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex justify-between text-xl font-bold text-indigo-600">
                    <span className="">Final Total (After Markup):</span>
                    <span>{frontendCalculatedSummary.markedUpTotal}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 