'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormInput } from '@/components/ui/FormInput';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader2, Package, Calculator, AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { batchInventoryApi, BatchStockInwardData, BatchMaterial } from '@/lib/api/batchInventoryService';
import { toast } from 'sonner';

interface BatchStockInwardFormProps {
  onSuccess?: (result: any) => void;
  onCancel?: () => void;
  prefilledData?: Partial<BatchStockInwardData>;
}

const BatchStockInwardForm: React.FC<BatchStockInwardFormProps> = ({
  onSuccess,
  onCancel,
  prefilledData
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [formData, setFormData] = useState<BatchStockInwardData>({
    // Material selection
    materialId: '',
    
    // New material fields
    name: '',
    category: 'Profile',
    stockUnit: 'piece',
    usageUnit: 'ft',
    brand: '',
    hsnCode: '',
    description: '',
    
    // Stock inward data
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
    notes: '',
    
    ...prefilledData
  });

  const [isNewMaterial, setIsNewMaterial] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableMaterials, setAvailableMaterials] = useState<BatchMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [calculatedValues, setCalculatedValues] = useState({
    ratePerPiece: 0,
    ratePerKg: 0,
    weightPerPiece: 0
  });

  // ============================================================================
  // LOAD AVAILABLE MATERIALS
  // ============================================================================
  
  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const response = await batchInventoryApi.getMaterials({ limit: 1000 });
      setAvailableMaterials(response.data);
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
    const { quantity, totalCost, actualWeight } = formData;
    
    const calculations = {
      ratePerPiece: quantity > 0 ? totalCost / quantity : 0,
      ratePerKg: actualWeight && actualWeight > 0 ? totalCost / actualWeight : 0,
      weightPerPiece: quantity > 0 && actualWeight && actualWeight > 0 ? actualWeight / quantity : 0
    };
    
    setCalculatedValues(calculations);
  }, [formData.quantity, formData.totalCost, formData.actualWeight]);

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

  const handleMaterialSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const materialId = e.target.value;
    
    if (materialId === 'new') {
      setIsNewMaterial(true);
      setFormData(prev => ({ ...prev, materialId: '' }));
    } else {
      setIsNewMaterial(false);
      const selectedMaterial = availableMaterials.find(m => m.id === materialId);
      if (selectedMaterial) {
        setFormData(prev => ({
          ...prev,
          materialId,
          category: selectedMaterial.category,
          stockUnit: selectedMaterial.stockUnit,
          usageUnit: selectedMaterial.usageUnit,
          supplier: selectedMaterial.supplier || prev.supplier
        }));
      }
    }
  };

  const validateForm = (): string | null => {
    if (isNewMaterial) {
      if (!formData.name?.trim()) return 'Material name is required';
      if (!formData.category) return 'Category is required';
    } else {
      if (!formData.materialId) return 'Please select a material';
    }
    
    if (!formData.length || formData.length <= 0) return 'Length must be greater than 0';
    if (!formData.quantity || formData.quantity <= 0) return 'Quantity must be greater than 0';
    if (!formData.totalCost || formData.totalCost <= 0) return 'Total cost must be greater than 0';
    if (!formData.lengthUnit) return 'Length unit is required';

    return null;
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
        ...formData,
        // Convert string inputs to numbers
        length: Number(formData.length),
        quantity: Number(formData.quantity),
        totalCost: Number(formData.totalCost),
        actualWeight: formData.actualWeight ? Number(formData.actualWeight) : undefined
      };

      // Remove material creation fields if using existing material
      if (!isNewMaterial) {
        delete submitData.name;
        delete submitData.category;
        delete submitData.stockUnit;
        delete submitData.usageUnit;
        delete submitData.brand;
        delete submitData.hsnCode;
        delete submitData.description;
      } else {
        delete submitData.materialId;
      }

      const result = await batchInventoryApi.recordStockInward(submitData);
      
      toast.success(
        `Stock inward recorded successfully! Batch ID: ${result.data.batchId}`,
        { duration: 5000 }
      );
      
      onSuccess?.(result);
      
      // Reset form for another entry
      if (!onCancel) {
        setFormData({
          materialId: '',
          name: '',
          category: 'Profile',
          stockUnit: 'piece',
          usageUnit: 'ft',
          brand: '',
          hsnCode: '',
          description: '',
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
        setIsNewMaterial(false);
      }
      
    } catch (error: any) {
      toast.error(error?.message || 'Failed to record stock inward');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Batch-Based Stock Inward</h1>
          </div>
          <p className="text-gray-600">
            Record new stock as separate batches. Each purchase maintains exact weights and rates.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* ===== MATERIAL SELECTION ===== */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">Material Selection</h2>
              <Badge className="bg-blue-100 text-blue-800">Step 1</Badge>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Material</label>
              <select
                name="materialSelection"
                value={isNewMaterial ? 'new' : formData.materialId}
                onChange={handleMaterialSelection}
                disabled={loadingMaterials}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  {loadingMaterials ? "Loading materials..." : "Choose existing or create new"}
                </option>
                <option value="new">
                  🆕 Create New Material
                </option>
                <optgroup label="Existing Materials">
                  {availableMaterials.map(material => (
                    <option key={material.id} value={material.id}>
                      {material.name} ({material.category}) - Stock: {material.aggregatedTotals.totalCurrentStock} {material.stockUnit}
                      {material.systemType === 'legacy' ? ' [Will migrate to batch system]' : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* New Material Fields */}
            {isNewMaterial && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Creating New Material</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput
                    id="name"
                    name="name"
                    label="Material Name *"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., 3Track Top"
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Profile">Profile</option>
                      <option value="Glass">Glass</option>
                      <option value="Hardware">Hardware</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Consumables">Consumables</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stock Unit</label>
                    <select
                      name="stockUnit"
                      value={formData.stockUnit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="piece">Piece</option>
                      <option value="kg">Kg</option>
                      <option value="sqft">Sq Ft</option>
                      <option value="sqm">Sq M</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Usage Unit</label>
                    <select
                      name="usageUnit"
                      value={formData.usageUnit}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ft">Feet</option>
                      <option value="inches">Inches</option>
                      <option value="mm">MM</option>
                      <option value="pcs">Pieces</option>
                      <option value="kg">Kg</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===== STOCK DETAILS ===== */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">Stock Details</h2>
              <Badge className="bg-green-100 text-green-800">Step 2</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <FormInput
                id="length"
                name="length"
                label="Length *"
                type="number"
                step="0.01"
                value={formData.length || ''}
                onChange={handleInputChange}
                placeholder="12"
                required
              />
              <div>
                <label className="block text-sm font-medium mb-1">Length Unit *</label>
                <select
                  name="lengthUnit"
                  value={formData.lengthUnit}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ft">Feet</option>
                  <option value="inches">Inches</option>
                  <option value="mm">MM</option>
                </select>
              </div>
              <FormInput
                id="gauge"
                name="gauge"
                label="Gauge"
                value={formData.gauge}
                onChange={handleInputChange}
                placeholder="18G"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                id="quantity"
                name="quantity"
                label="Quantity (Pieces) *"
                type="number"
                step="1"
                value={formData.quantity || ''}
                onChange={handleInputChange}
                placeholder="20"
                required
              />
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
          </div>

          {/* ===== ACTUAL WEIGHT (OPTIONAL) ===== */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">Actual Weight</h2>
              <Badge className="bg-purple-100 text-purple-800">Optional but Recommended</Badge>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Enter the actual weighed amount. This will be preserved exactly and never recalculated.
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                id="actualWeight"
                name="actualWeight"
                label="Actual Total Weight"
                type="number"
                step="0.01"
                value={formData.actualWeight || ''}
                onChange={handleInputChange}
                placeholder="14.5"
              />
              <div>
                <label className="block text-sm font-medium mb-1">Weight Unit</label>
                <select
                  name="actualWeightUnit"
                  value={formData.actualWeightUnit}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kg">Kg</option>
                  <option value="lbs">Lbs</option>
                </select>
              </div>
            </div>
          </div>

          {/* ===== PURCHASE DETAILS ===== */}
          <div className="border rounded-lg p-4">
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
          </div>

          {/* ===== CALCULATED VALUES ===== */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">Calculated Rates</h2>
              <Badge className="bg-gray-100 text-gray-800">Auto-calculated</Badge>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Live Calculations</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-600">Rate per Piece</div>
                  <div className="text-lg font-bold text-green-600">
                    ₹{calculatedValues.ratePerPiece.toFixed(2)}
                  </div>
                </div>
                {calculatedValues.ratePerKg > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-600">Rate per Kg</div>
                    <div className="text-lg font-bold text-blue-600">
                      ₹{calculatedValues.ratePerKg.toFixed(2)}
                    </div>
                  </div>
                )}
                {calculatedValues.weightPerPiece > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-600">Weight per Piece</div>
                    <div className="text-lg font-bold text-purple-600">
                      {calculatedValues.weightPerPiece.toFixed(3)} kg
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== ACTION BUTTONS ===== */}
          <div className="flex justify-end gap-4 pt-6 border-t">
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Stock Inward
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default BatchStockInwardForm; 