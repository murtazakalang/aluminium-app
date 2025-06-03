'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormInput } from '@/components/ui/FormInput';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader2, Package, Calculator, AlertCircle, CheckCircle, Info, ArrowLeft } from 'lucide-react';
import { batchInventoryApi, BatchStockInwardData, BatchMaterial } from '@/lib/api/batchInventoryService';
import { toast } from 'sonner';

interface SimplifiedBatchStockInwardFormProps {
  onSuccess?: (result: any) => void;
  onCancel?: () => void;
  prefilledMaterialId?: string;
}

interface MaterialWithConfig extends BatchMaterial {
  standardLengths?: Array<{ length: string; unit: string }>;
  referenceGaugeWeights?: Array<{ gauge: string; referenceWeight: string; unitLength: string }>;
}

const SimplifiedBatchStockInwardForm: React.FC<SimplifiedBatchStockInwardFormProps> = ({
  onSuccess,
  onCancel,
  prefilledMaterialId
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [formData, setFormData] = useState<BatchStockInwardData>({
    materialId: prefilledMaterialId || '',
    length: 0,
    lengthUnit: 'ft',
    gauge: '',
    quantity: 0,
    actualWeight: 0,
    actualWeightUnit: 'kg',
    totalCost: 0,
    supplier: '',
    invoiceNumber: '',
    lotNumber: '',
    notes: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [availableMaterials, setAvailableMaterials] = useState<MaterialWithConfig[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialWithConfig | null>(null);
  const [calculatedValues, setCalculatedValues] = useState({
    ratePerPiece: 0,
    ratePerKg: 0,
    weightPerPiece: 0,
    expectedWeight: 0
  });

  // ============================================================================
  // LOAD AVAILABLE MATERIALS
  // ============================================================================
  
  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    if (prefilledMaterialId && availableMaterials.length > 0) {
      const material = availableMaterials.find(m => m.id === prefilledMaterialId);
      if (material) {
        handleMaterialSelection(prefilledMaterialId);
      }
    }
  }, [prefilledMaterialId, availableMaterials]);

  const loadMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const response = await batchInventoryApi.getMaterials({ limit: 1000 });
      
      // Filter to only show materials created with the new system that have predefined configurations
      const configuredMaterials = response.data.filter(material => 
        material.systemType === 'v2' // Only new simplified materials
      );
      
      setAvailableMaterials(configuredMaterials);
    } catch (error) {
      toast.error('Failed to load materials');
    } finally {
      setLoadingMaterials(false);
    }
  };

  // ============================================================================
  // CALCULATIONS
  // ============================================================================
  
  useEffect(() => {
    const { quantity, totalCost, actualWeight, length, gauge } = formData;
    
    let expectedWeight = 0;
    if (selectedMaterial && selectedMaterial.category === 'Profile' && gauge && length) {
      const gaugeWeight = selectedMaterial.referenceGaugeWeights?.find(g => g.gauge === gauge);
      if (gaugeWeight) {
        expectedWeight = parseFloat(gaugeWeight.referenceWeight) * length * quantity;
      }
    }
    
    const calculations = {
      ratePerPiece: quantity > 0 ? totalCost / quantity : 0,
      ratePerKg: actualWeight && actualWeight > 0 ? totalCost / actualWeight : 0,
      weightPerPiece: quantity > 0 && actualWeight && actualWeight > 0 ? actualWeight / quantity : 0,
      expectedWeight
    };
    
    setCalculatedValues(calculations);
  }, [formData, selectedMaterial]);

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMaterialSelection = async (materialId: string) => {
    if (!materialId) {
      setSelectedMaterial(null);
      setFormData(prev => ({ 
        ...prev, 
        materialId: '',
        length: 0,
        lengthUnit: 'ft',
        gauge: ''
      }));
      return;
    }

    const material = availableMaterials.find(m => m.id === materialId);
    if (material) {
      setSelectedMaterial(material);
      
      // Auto-set first available length and gauge
      const firstLength = material.standardLengths?.[0];
      const firstGauge = material.referenceGaugeWeights?.[0];
      
      setFormData(prev => ({
        ...prev,
        materialId,
        length: firstLength ? parseFloat(firstLength.length) : prev.length,
        lengthUnit: firstLength ? firstLength.unit : prev.lengthUnit,
        gauge: firstGauge ? firstGauge.gauge : prev.gauge
      }));
    }
  };

  const validateForm = (): string | null => {
    if (!formData.materialId) return 'Please select a material';
    
    // Wire Mesh specific validation
    if (selectedMaterial?.category === 'Wire Mesh') {
      if (!formData.gauge) return 'Please select a standard width';
      if (!formData.length || formData.length <= 0) return 'Roll length must be greater than 0';
    }
    
    // Only require length for Profile materials or materials that have standard lengths defined (but not Wire Mesh)
    if (selectedMaterial?.category !== 'Wire Mesh' && selectedMaterial?.standardLengths && selectedMaterial.standardLengths.length > 0) {
      if (!formData.length || formData.length <= 0) return 'Length must be greater than 0';
    }
    
    if (!formData.quantity || formData.quantity <= 0) return 'Quantity must be greater than 0';
    if (!formData.totalCost || formData.totalCost <= 0) return 'Total cost must be greater than 0';
    if (selectedMaterial?.category === 'Profile' && !formData.gauge) return 'Gauge is required for Profile materials';

    return null;
  };

  // Helper function to get quantity unit based on material category
  const getQuantityUnit = () => {
    if (!selectedMaterial) return 'pieces';
    
    switch (selectedMaterial.category) {
      case 'Profile':
        return 'pieces';
      case 'Wire Mesh':
        return 'rolls';
      case 'Glass':
        return selectedMaterial.usageUnit || 'sqft';
      case 'Hardware':
      case 'Accessories':
      case 'Consumables':
        return selectedMaterial.usageUnit || 'pcs';
      default:
        return 'pieces';
    }
  };

  // Helper function to get quantity label
  const getQuantityLabel = () => {
    const unit = getQuantityUnit();
    return `Quantity (${unit}) *`;
  };

  // Helper function to calculate Wire Mesh area
  const getWireMeshAreaCalculation = () => {
    if (selectedMaterial?.category !== 'Wire Mesh' || !formData.gauge || !formData.length || !formData.quantity) {
      return null;
    }
    
    const width = parseFloat(formData.gauge);
    const length = parseFloat(formData.length.toString());
    const quantity = parseFloat(formData.quantity.toString());
    
    if (isNaN(width) || isNaN(length) || isNaN(quantity)) return null;
    
    const areaPerRoll = width * length;
    const totalArea = areaPerRoll * quantity;
    
    return {
      width,
      length,
      quantity,
      areaPerRoll,
      totalArea,
      areaUnit: 'sqft' // Assuming ft for now
    };
  };

  // Helper function to check if weight field should be shown
  const shouldShowWeightField = () => {
    return selectedMaterial?.category === 'Profile';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setIsLoading(true);
      
      const submitData: BatchStockInwardData = {
        materialId: formData.materialId,
        length: (selectedMaterial?.category === 'Profile' || selectedMaterial?.category === 'Wire Mesh') ? Number(formData.length) : undefined,
        lengthUnit: (selectedMaterial?.category === 'Profile' || selectedMaterial?.category === 'Wire Mesh') ? formData.lengthUnit : undefined,
        gauge: (selectedMaterial?.category === 'Profile' || selectedMaterial?.category === 'Wire Mesh') ? formData.gauge : undefined,
        quantity: Number(formData.quantity),
        totalCost: Number(formData.totalCost),
        actualWeight: shouldShowWeightField() && formData.actualWeight ? Number(formData.actualWeight) : undefined,
        actualWeightUnit: formData.actualWeightUnit,
        supplier: formData.supplier,
        invoiceNumber: formData.invoiceNumber,
        lotNumber: formData.lotNumber,
        notes: formData.notes
      };

      const result = await batchInventoryApi.recordStockInward(submitData);
      
      toast.success(
        `Stock inward recorded successfully! Batch ID: ${result.data.batchId}`,
        { duration: 5000 }
      );
      
      // Call success callback
      if (onSuccess) {
        onSuccess(result);
      }
      
      // Refresh materials list
      await loadMaterials();
      
      // Reset form for next entry
      const currentMaterialId = formData.materialId;
      setFormData({
        materialId: currentMaterialId, // Keep the same material selected
        length: 0,
        lengthUnit: 'ft',
        gauge: '',
        quantity: 0,
        actualWeight: 0,
        actualWeightUnit: 'kg',
        totalCost: 0,
        supplier: formData.supplier, // Keep supplier for convenience
        invoiceNumber: '',
        lotNumber: '',
        notes: ''
      });
      
      // Re-trigger material selection to reset length and gauge
      if (currentMaterialId) {
        const material = availableMaterials.find(m => m.id === currentMaterialId);
        if (material) {
          const firstLength = material.standardLengths?.[0];
          const firstGauge = material.referenceGaugeWeights?.[0];
          
          setFormData(prev => ({
            ...prev,
            length: firstLength ? parseFloat(firstLength.length) : 0,
            lengthUnit: firstLength ? firstLength.unit : 'ft',
            gauge: firstGauge ? firstGauge.gauge : ''
          }));
        }
      }
      
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to record stock inward';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-green-600" />
            <div>
              <h1 className="text-xl font-semibold">Stock Inward</h1>
              <p className="text-sm text-gray-600">Record stock inward using predefined material configurations. Select length and gauge from available options.</p>
            </div>
            <Badge className="bg-green-100 text-green-800">Batch Tracking</Badge>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Material Selection */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Material Selection</h2>
            <Badge className="bg-blue-100 text-blue-800">Step 1</Badge>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Material</label>
            <select
              name="materialId"
              value={formData.materialId}
              onChange={(e) => handleMaterialSelection(e.target.value)}
              disabled={loadingMaterials}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                {loadingMaterials ? "Loading materials..." : "Choose a material"}
              </option>
              {availableMaterials.map(material => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.category}) - Stock: {material.aggregatedTotals.totalCurrentStock} {material.stockUnit}
                </option>
              ))}
            </select>
          </div>

          {selectedMaterial && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Material Configuration</span>
              </div>
              <div className="text-sm text-green-700">
                <p><strong>Category:</strong> {selectedMaterial.category}</p>
                <p><strong>Stock Unit:</strong> {selectedMaterial.stockUnit}</p>
                <p><strong>Usage Unit:</strong> {selectedMaterial.usageUnit}</p>
                {selectedMaterial.standardLengths && selectedMaterial.standardLengths.length > 0 && (
                  <p><strong>Available Lengths:</strong> {selectedMaterial.standardLengths.map(sl => `${sl.length}${sl.unit}`).join(', ')}</p>
                )}
                {selectedMaterial.referenceGaugeWeights && selectedMaterial.referenceGaugeWeights.length > 0 && (
                  <p><strong>Available Gauges:</strong> {selectedMaterial.referenceGaugeWeights.map(g => g.gauge).join(', ')}</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Category-specific Info */}
        {selectedMaterial && (
          <Card className="p-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">
                    {selectedMaterial.category} Material Requirements
                  </h4>
                  <div className="text-blue-700 text-sm">
                    {selectedMaterial.category === 'Profile' && (
                      <p>
                        For Profile materials: Select length and gauge, enter quantity in pieces, 
                        and optionally provide actual weight for accurate rate calculations.
                      </p>
                    )}
                    {selectedMaterial.category === 'Glass' && (
                      <p>
                        For Glass materials: Enter quantity in {selectedMaterial.usageUnit || 'sqft'} 
                        and total cost. No length/gauge or weight information needed.
                      </p>
                    )}
                    {(selectedMaterial.category === 'Hardware' || 
                      selectedMaterial.category === 'Accessories' || 
                      selectedMaterial.category === 'Consumables') && (
                      <p>
                        For {selectedMaterial.category}: Enter quantity in {selectedMaterial.usageUnit || 'pcs'} 
                        and total cost. No length/gauge or weight information needed.
                      </p>
                    )}
                    {selectedMaterial.category === 'Wire Mesh' && (
                      <p>
                        For Wire Mesh materials: Select standard width from available options, enter roll length, 
                        and quantity (number of rolls). Total area will be automatically calculated.
                      </p>
                    )}
                    {selectedMaterial.category !== 'Wire Mesh' && selectedMaterial.standardLengths && selectedMaterial.standardLengths.length > 0 && (
                      <p><strong>Available Lengths:</strong> {selectedMaterial.standardLengths.map(sl => `${sl.length}${sl.unit}`).join(', ')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {selectedMaterial && (
          <>
            {/* Stock Details */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">Stock Details</h2>
                <Badge className="bg-green-100 text-green-800">Step 2</Badge>
              </div>
              
              <div className={`grid gap-4 mb-4 ${
                selectedMaterial.category === 'Profile' ? 'grid-cols-1 md:grid-cols-3' : 
                selectedMaterial.category === 'Wire Mesh' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
              }`}>
                {selectedMaterial.category === 'Wire Mesh' && selectedMaterial.standardLengths && selectedMaterial.standardLengths.length > 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Standard Width *</label>
                      <select
                        name="gauge"
                        value={formData.gauge}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Width</option>
                        {selectedMaterial.standardLengths?.map((width, index) => (
                          <option key={index} value={width.length}>
                            {width.length} {width.unit}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Roll Length *</label>
                      <input
                        type="number"
                        name="length"
                        step="0.1"
                        value={formData.length || ''}
                        onChange={handleInputChange}
                        placeholder="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Length Unit *</label>
                      <select
                        name="lengthUnit"
                        value={formData.lengthUnit}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ft">ft</option>
                        <option value="m">m</option>
                      </select>
                    </div>
                  </>
                )}
                {selectedMaterial.category !== 'Wire Mesh' && selectedMaterial.standardLengths && selectedMaterial.standardLengths.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Length *</label>
                    <select
                      name="length"
                      value={formData.length || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Length</option>
                      {selectedMaterial.standardLengths?.map((length, index) => (
                        <option key={index} value={length.length}>
                          {length.length} {length.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {selectedMaterial.category === 'Profile' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Gauge *</label>
                    <select
                      name="gauge"
                      value={formData.gauge}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Gauge</option>
                      {selectedMaterial.referenceGaugeWeights?.map((gauge, index) => (
                        <option key={index} value={gauge.gauge}>
                          {gauge.gauge} ({gauge.referenceWeight} kg/ft)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <FormInput
                  id="quantity"
                  name="quantity"
                  label={getQuantityLabel()}
                  type="number"
                  step="1"
                  value={formData.quantity || ''}
                  onChange={handleInputChange}
                  placeholder="20"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shouldShowWeightField() && (
                  <FormInput
                    id="actualWeight"
                    name="actualWeight"
                    label="Actual Total Weight"
                    type="number"
                    step="0.01"
                    value={formData.actualWeight || ''}
                    onChange={handleInputChange}
                    placeholder="Weighed amount (optional)"
                  />
                )}

                <FormInput
                  id="totalCost"
                  name="totalCost"
                  label="Total Cost Paid *"
                  type="number"
                  step="0.01"
                  value={formData.totalCost || ''}
                  onChange={handleInputChange}
                  placeholder="3200"
                  required
                />                  
              </div>

              {/* Expected vs Actual Weight Comparison */}
              {selectedMaterial.category === 'Profile' && shouldShowWeightField() && calculatedValues.expectedWeight > 0 && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Weight Comparison</span>
                  </div>
                  <div className="text-sm text-blue-700">
                    <p><strong>Expected Weight:</strong> {calculatedValues.expectedWeight.toFixed(2)} kg (based on gauge weight)</p>
                    {formData.actualWeight && (
                      <p><strong>Actual Weight:</strong> {formData.actualWeight} kg</p>
                    )}
                    {formData.actualWeight && Math.abs(formData.actualWeight - calculatedValues.expectedWeight) > 0.5 && (
                      <p className="text-yellow-700">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        Weight difference: {(formData.actualWeight - calculatedValues.expectedWeight).toFixed(2)} kg
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Purchase Details */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">Purchase Details</h2>
                <Badge className="bg-orange-100 text-orange-800">Step 3</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormInput
                  id="supplier"
                  name="supplier"
                  label="Supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                  placeholder="TATA Steel"
                />
                <FormInput
                  id="invoiceNumber"
                  name="invoiceNumber"
                  label="Invoice Number"
                  value={formData.invoiceNumber}
                  onChange={handleInputChange}
                  placeholder="INV-2024-001"
                />
                <FormInput
                  id="lotNumber"
                  name="lotNumber"
                  label="Lot Number"
                  value={formData.lotNumber}
                  onChange={handleInputChange}
                  placeholder="LOT-A123"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Additional notes about this batch..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </Card>

            {/* Calculated Values */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Auto-Calculated Rates</h2>
                <Badge className="bg-gray-100 text-gray-800">Live Calculations</Badge>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-600">Rate per {getQuantityUnit()}</div>
                    <div className="text-lg font-bold text-green-600">
                      ₹{calculatedValues.ratePerPiece.toFixed(2)}
                    </div>
                  </div>
                  {selectedMaterial?.category === 'Wire Mesh' && (() => {
                    const areaCalc = getWireMeshAreaCalculation();
                    return areaCalc && formData.totalCost && areaCalc.totalArea > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-600">Rate per {areaCalc.areaUnit}</div>
                        <div className="text-lg font-bold text-indigo-600">
                          ₹{(formData.totalCost / areaCalc.totalArea).toFixed(2)}
                        </div>
                      </div>
                    );
                  })()}
                  {shouldShowWeightField() && calculatedValues.ratePerKg > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-600">Rate per Kg</div>
                      <div className="text-lg font-bold text-blue-600">
                        ₹{calculatedValues.ratePerKg.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {shouldShowWeightField() && calculatedValues.weightPerPiece > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-600">Weight per Piece</div>
                      <div className="text-lg font-bold text-purple-600">
                        {calculatedValues.weightPerPiece.toFixed(3)} kg
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Wire Mesh Area Calculation */}
              {selectedMaterial?.category === 'Wire Mesh' && (() => {
                const areaCalc = getWireMeshAreaCalculation();
                return areaCalc && (
                  <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-medium text-indigo-800">Wire Mesh Area Calculation</span>
                    </div>
                    <div className="text-sm text-indigo-700 grid grid-cols-2 gap-2">
                      <p><strong>Width:</strong> {areaCalc.width} ft</p>
                      <p><strong>Roll Length:</strong> {areaCalc.length} ft</p>
                      <p><strong>Area per Roll:</strong> {areaCalc.areaPerRoll.toFixed(2)} {areaCalc.areaUnit}</p>
                      <p><strong>Total Area:</strong> {areaCalc.totalArea.toFixed(2)} {areaCalc.areaUnit}</p>
                    </div>
                  </div>
                );
              })()}
            </Card>

            {/* Action Buttons */}
            <Card className="p-6">
              <div className="flex justify-end gap-4">
                {onCancel && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Stock Inward
                </Button>
              </div>
            </Card>
          </>
        )}
      </form>
    </div>
  );
};

export default SimplifiedBatchStockInwardForm; 