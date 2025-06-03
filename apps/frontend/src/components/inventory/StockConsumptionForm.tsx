'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  Minus, AlertTriangle, CheckCircle, Clock, 
  Package, Scale, TrendingDown, Shuffle
} from 'lucide-react';
import { 
  batchInventoryApi, 
  StockConsumptionData, 
  StockBatch, 
  AvailableBatchFilters 
} from '@/lib/api/batchInventoryService';
import { toast } from 'sonner';

interface StockConsumptionFormProps {
  materialId: string;
  materialName: string;
  onSuccess?: (result: any) => void;
  onCancel?: () => void;
  prefilledData?: Partial<StockConsumptionData>;
}

const StockConsumptionForm: React.FC<StockConsumptionFormProps> = ({
  materialId,
  materialName,
  onSuccess,
  onCancel,
  prefilledData
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [formData, setFormData] = useState<StockConsumptionData>({
    materialId,
    length: undefined,
    lengthUnit: 'ft',
    gauge: '',
    quantityNeeded: 0,
    consumptionType: 'Production',
    sortOrder: 'FIFO',
    notes: '',
    ...prefilledData
  });

  const [availableBatches, setAvailableBatches] = useState<StockBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [consumptionPreview, setConsumptionPreview] = useState<{
    canFulfill: boolean;
    totalAvailable: number;
    shortfall: number;
    batchBreakdown: Array<{
      batchId: string;
      quantity: number;
      supplier: string;
      rate: number;
    }>;
  }>({
    canFulfill: false,
    totalAvailable: 0,
    shortfall: 0,
    batchBreakdown: []
  });

  // ============================================================================
  // LOAD AVAILABLE BATCHES
  // ============================================================================
  
  useEffect(() => {
    loadAvailableBatches();
  }, [materialId, formData.length, formData.lengthUnit, formData.gauge, formData.sortOrder]);

  const loadAvailableBatches = async () => {
    try {
      setLoadingBatches(true);
      
      const filters: AvailableBatchFilters = {
        sortOrder: formData.sortOrder,
        minQuantity: 0.01
      };
      
      if (formData.length) filters.length = formData.length;
      if (formData.lengthUnit) filters.lengthUnit = formData.lengthUnit;
      if (formData.gauge) filters.gauge = formData.gauge;

      const response = await batchInventoryApi.getAvailableBatches(materialId, filters);
      setAvailableBatches(response.data);
      calculateConsumptionPreview(response.data);
      
    } catch (error) {
      toast.error('Failed to load available batches');
    } finally {
      setLoadingBatches(false);
    }
  };

  // ============================================================================
  // CONSUMPTION PREVIEW CALCULATION
  // ============================================================================
  
  useEffect(() => {
    calculateConsumptionPreview(availableBatches);
  }, [formData.quantityNeeded, availableBatches]);

  const calculateConsumptionPreview = (batches: StockBatch[]) => {
    const quantityNeeded = formData.quantityNeeded || 0;
    let remainingNeeded = quantityNeeded;
    const breakdown: typeof consumptionPreview.batchBreakdown = [];
    
    const totalAvailable = batches.reduce((sum, batch) => 
      sum + parseFloat(batch.currentQuantity), 0
    );

    for (const batch of batches) {
      if (remainingNeeded <= 0) break;
      
      const available = parseFloat(batch.currentQuantity);
      const toConsume = Math.min(remainingNeeded, available);
      
      if (toConsume > 0) {
        breakdown.push({
          batchId: batch.batchId,
          quantity: toConsume,
          supplier: batch.supplier || 'Unknown',
          rate: parseFloat(batch.ratePerPiece)
        });
        remainingNeeded -= toConsume;
      }
    }

    setConsumptionPreview({
      canFulfill: remainingNeeded <= 0,
      totalAvailable,
      shortfall: Math.max(0, remainingNeeded),
      batchBreakdown: breakdown
    });
  };

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

  const validateForm = (): string | null => {
    if (!formData.quantityNeeded || formData.quantityNeeded <= 0) {
      return 'Quantity needed must be greater than 0';
    }
    
    if (!consumptionPreview.canFulfill) {
      return `Insufficient stock. Need ${formData.quantityNeeded}, available ${consumptionPreview.totalAvailable}`;
    }

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
      
      const submitData: StockConsumptionData = {
        ...formData,
        length: formData.length ? Number(formData.length) : undefined,
        quantityNeeded: Number(formData.quantityNeeded)
      };

      const result = await batchInventoryApi.consumeStock(submitData);
      
      toast.success(
        `Stock consumed successfully! Total consumed: ${result.data.totalConsumed} pieces`,
        { duration: 5000 }
      );
      
      onSuccess?.(result);
      
      // Reset form for another consumption
      if (!onCancel) {
        setFormData({
          materialId,
          length: undefined,
          lengthUnit: 'ft',
          gauge: '',
          quantityNeeded: 0,
          consumptionType: 'Production',
          sortOrder: 'FIFO',
          notes: ''
        });
      }
      
    } catch (error: any) {
      toast.error(error?.message || 'Failed to consume stock');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    });
  };

  const getUtilizationColor = (utilizationPercent: string) => {
    const utilization = parseFloat(utilizationPercent);
    if (utilization < 50) return 'text-green-600';
    if (utilization < 90) return 'text-yellow-600';
    return 'text-red-600';
  };

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ===== CONSUMPTION FORM ===== */}
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Minus className="h-6 w-6 text-red-600" />
              <h1 className="text-2xl font-bold">Stock Consumption</h1>
            </div>
            <p className="text-gray-600">
              Consume stock from <span className="font-semibold">{materialName}</span> using FIFO/LIFO
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ===== FILTER CRITERIA ===== */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">Filter Criteria</h2>
                <Badge className="bg-blue-100 text-blue-800">Optional</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  label="Length"
                  type="number"
                  step="0.01"
                  name="length"
                  value={formData.length || ''}
                  onChange={handleInputChange}
                  placeholder="12"
                />
                <div>
                  <label className="block text-sm font-medium mb-1">Length Unit</label>
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
                  label="Gauge"
                  name="gauge"
                  value={formData.gauge}
                  onChange={handleInputChange}
                  placeholder="18G"
                />
              </div>
            </div>

            {/* ===== CONSUMPTION DETAILS ===== */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">Consumption Details</h2>
                <Badge className="bg-red-100 text-red-800">Required</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormInput
                  label="Quantity Needed *"
                  type="number"
                  step="1"
                  name="quantityNeeded"
                  value={formData.quantityNeeded || ''}
                  onChange={handleInputChange}
                  placeholder="25"
                  required
                />
                <div>
                  <label className="block text-sm font-medium mb-1">Sort Order</label>
                  <select
                    name="sortOrder"
                    value={formData.sortOrder}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FIFO">FIFO (First In, First Out)</option>
                    <option value="LIFO">LIFO (Last In, First Out)</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Consumption Type</label>
                  <select
                    name="consumptionType"
                    value={formData.consumptionType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Production">Production</option>
                    <option value="Scrap">Scrap</option>
                    <option value="Transfer">Transfer</option>
                    <option value="QualityTest">Quality Test</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Reason for consumption..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* ===== CONSUMPTION PREVIEW ===== */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Scale className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Consumption Preview</h2>
              </div>
              
              {formData.quantityNeeded > 0 ? (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${
                    consumptionPreview.canFulfill 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {consumptionPreview.canFulfill ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      consumptionPreview.canFulfill ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {consumptionPreview.canFulfill 
                        ? `✓ Can fulfill order (${consumptionPreview.totalAvailable} available)`
                        : `✗ Insufficient stock (shortfall: ${consumptionPreview.shortfall})`
                      }
                    </span>
                  </div>
                  
                  {consumptionPreview.batchBreakdown.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Consumption breakdown:</h3>
                      <div className="space-y-2">
                        {consumptionPreview.batchBreakdown.map((item, index) => (
                          <div key={index} className="text-xs bg-gray-50 p-2 rounded flex justify-between">
                            <span>
                              Batch {item.batchId.slice(-6)} ({item.supplier}): {item.quantity} pcs
                            </span>
                            <span className="font-medium">
                              ₹{(item.quantity * item.rate).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  Enter quantity needed to see consumption preview
                </div>
              )}
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
                disabled={isLoading || !consumptionPreview.canFulfill}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
              >
                {isLoading && <Clock className="mr-2 h-4 w-4 animate-spin" />}
                Consume Stock
              </Button>
            </div>
          </form>
        </Card>

        {/* ===== AVAILABLE BATCHES ===== */}
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-6 w-6 text-green-600" />
              <h2 className="text-2xl font-bold">Available Batches</h2>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Order: {formData.sortOrder}</span>
              <span>•</span>
              <span>{availableBatches.length} batches</span>
              <span>•</span>
              <span>{consumptionPreview.totalAvailable} pieces available</span>
            </div>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loadingBatches ? (
              <div className="text-center py-8 text-gray-500">
                Loading available batches...
              </div>
            ) : availableBatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No batches available with current filters
              </div>
            ) : (
              availableBatches.map((batch, index) => {
                const willBeConsumed = consumptionPreview.batchBreakdown.some(
                  item => item.batchId === batch.batchId
                );
                const consumedQty = consumptionPreview.batchBreakdown.find(
                  item => item.batchId === batch.batchId
                )?.quantity || 0;
                
                return (
                  <div 
                    key={batch.batchId}
                    className={`border rounded-lg p-3 transition-all ${
                      willBeConsumed 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-sm">
                          {batch.batchId.slice(-8)}
                          {index === 0 && (
                            <Badge className="ml-2 bg-blue-100 text-blue-800 text-xs">
                              Next
                            </Badge>
                          )}
                          {willBeConsumed && (
                            <Badge className="ml-2 bg-red-100 text-red-800 text-xs">
                              Will Consume: {consumedQty}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(batch.purchaseDate)} • {batch.supplier || 'Unknown'}
                        </div>
                      </div>
                      <Badge className="bg-gray-100 text-gray-800 text-xs">
                        {batch.length} {batch.lengthUnit}
                        {batch.gauge && ` ${batch.gauge}`}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500">Available:</span>
                        <div className="font-medium">{batch.currentQuantity} pcs</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Rate:</span>
                        <div className="font-medium">₹{parseFloat(batch.ratePerPiece).toFixed(2)}</div>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        Utilization: 
                        <span className={`ml-1 font-medium ${getUtilizationColor(batch.utilizationPercent)}`}>
                          {batch.utilizationPercent}%
                        </span>
                      </div>
                      {batch.actualTotalWeight && (
                        <div className="text-xs text-gray-500">
                          {(parseFloat(batch.actualTotalWeight) * parseFloat(batch.currentQuantity) / parseFloat(batch.originalQuantity)).toFixed(2)} kg
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {availableBatches.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-gray-500 space-y-1">
                <div>Total batches: {availableBatches.length}</div>
                <div>Total available: {consumptionPreview.totalAvailable} pieces</div>
                <div>Sorting: {formData.sortOrder} (oldest first)</div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StockConsumptionForm; 