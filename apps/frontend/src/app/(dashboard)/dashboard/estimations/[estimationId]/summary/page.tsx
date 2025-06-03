'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { estimationApi, Estimation, CalculatedMaterial, EstimationItem } from '@/lib/api/estimationService';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

export default function EstimationSummaryPage() {
  const router = useRouter();
  const params = useParams();
  const estimationId = params.estimationId as string;
  
  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    if (!estimationId) return;
    fetchEstimationData();
  }, [estimationId]);

  const fetchEstimationData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await estimationApi.getEstimation(estimationId);
      setEstimation(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load estimation details.';
      setError(errorMessage);
      toast.error('Error fetching estimation', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!estimationId) return;
    setActionInProgress(true);
    try {
      const { generateAndDownloadPDF } = await import('@/lib/utils/pdfUtils');
      
      await generateAndDownloadPDF(
        () => estimationApi.generatePDF(estimationId),
        `estimation-${estimation?.projectName?.replace(/\s+/g, '-') || 'estimation'}.pdf`
      );
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF.';
      setError(errorMessage);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleConvertToQuotation = async () => {
    if (!estimationId) return;
    setActionInProgress(true);
    try {
      const response = await estimationApi.convertToQuotation(estimationId);
      toast.success('Estimation Converted', {
        description: `Successfully converted to Quotation ID: ${response.quotationId}`,
        action: {
          label: 'View Quotation',
          onClick: () => router.push(`/dashboard/quotations/${response.quotationId}/edit`),
        },
      });
      fetchEstimationData(); // Refresh data to show updated status
      // Redirect to quotation edit page after a short delay
      setTimeout(() => {
        router.push(`/dashboard/quotations/${response.quotationId}/edit`);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert to quotation.';
      setError(errorMessage);
      toast.error('Conversion Failed', { description: errorMessage });
    } finally {
      setActionInProgress(false);
    }
  };

  const formatDecimal = (value: any, precision: number = 2): string => {
    if (value === null || value === undefined) return 'N/A';
    let numValue = NaN;
    if (typeof value === 'object' && value !== null && value.$numberDecimal !== undefined) {
      numValue = parseFloat(value.$numberDecimal);
    } else {
      numValue = parseFloat(value.toString());
    }
    return isNaN(numValue) ? 'N/A' : numValue.toFixed(precision);
  };

  const getStatusBadgeVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Calculated': return 'default'; // Blueish in shadcn
      case 'Converted': return 'secondary'; // Greenish or another distinct color
      case 'Draft': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading summary...</div>;
  }

  if (error || !estimation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Estimation</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'Estimation data could not be loaded. Please try again or contact support if the issue persists.'}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard/estimations')} variant="outline">
              Back to Estimations List
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Estimation Summary: {estimation.projectName}</h1>
        <Badge variant={getStatusBadgeVariant(estimation.status)} className="text-sm">{estimation.status}</Badge>
      </div>

      <div className="flex space-x-2">
        <Button onClick={() => router.push(`/dashboard/estimations/${estimationId}`)} variant="outline" disabled={actionInProgress}>
          View Full Details
        </Button>
        {estimation.status === 'Calculated' && (
          <Button onClick={handleConvertToQuotation} variant="default" disabled={actionInProgress}>
            {actionInProgress ? 'Converting...' : 'Convert to Quotation'}
          </Button>
        )}
        <Button onClick={handleGeneratePDF} variant="secondary" disabled={actionInProgress}>
          {actionInProgress ? 'Generating PDF...' : 'Download PDF'}
        </Button>
        <Button onClick={() => router.push(`/dashboard/estimations/${estimationId}/edit`)} variant="outline" disabled={actionInProgress}>
            Edit Estimation
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Key Information</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div><span className="font-semibold">Project Name:</span> {estimation.projectName}</div>
          <div><span className="font-semibold">Client:</span> {estimation.clientNameSnapshot || (typeof estimation.clientId === 'object' && estimation.clientId?.clientName) || 'N/A'}</div>
          <div><span className="font-semibold">Dimension Unit:</span> {estimation.dimensionUnitUsed}</div>
          <div><span className="font-semibold">Created:</span> {new Date(estimation.createdAt).toLocaleDateString()}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Estimation Items</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Width ({estimation.dimensionUnitUsed})</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Height ({estimation.dimensionUnitUsed})</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {estimation.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.itemLabel || `Item ${index + 1}`}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatDecimal(item.width)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatDecimal(item.height)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {estimation.calculatedMaterials && estimation.calculatedMaterials.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Material Requirements & Costs</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Qty</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate (Manual/Auto)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate Unit</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {estimation.calculatedMaterials.map((mat, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{mat.materialNameSnapshot}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mat.materialCategorySnapshot}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatDecimal(mat.totalQuantity)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mat.quantityUnit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {formatDecimal(mat.manualUnitRate)} (M) / {formatDecimal(mat.autoUnitRate)} (A)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mat.manualRateUnit || mat.autoRateUnit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatDecimal(mat.calculatedCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {estimation.manualCharges && estimation.manualCharges.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Manual Charges</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {estimation.manualCharges.map((charge, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{charge.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatDecimal(charge.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between"><span className="font-semibold">Subtotal Materials:</span> {formatDecimal(estimation.subtotalMaterials)}</div>
          <div className="flex justify-between"><span className="font-semibold">Subtotal Manual Charges:</span> {formatDecimal(estimation.subtotalManualCharges)}</div>
          <div className="font-bold flex justify-between"><span className="font-semibold">Total Estimated Cost:</span> {formatDecimal(estimation.totalEstimatedCost)}</div>
          <div className="flex justify-between"><span className="font-semibold">Markup:</span> {formatDecimal(estimation.markupPercentage)}%</div>
          <div className="text-xl font-bold flex justify-between"><span className="font-semibold">Final Marked-Up Total:</span> {formatDecimal(estimation.markedUpTotal)}</div>
        </CardContent>
      </Card>

      {estimation.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{estimation.notes}</p>
          </CardContent>
        </Card>
      )}

    </div>
  );
} 