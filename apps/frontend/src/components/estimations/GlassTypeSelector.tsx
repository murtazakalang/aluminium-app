import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { inventoryApi, Material } from '@/lib/api/inventoryService';
import { productApi, GlassFormula } from '@/lib/api/productService';

interface GlassTypeSelectorProps {
  selectedGlassTypeId?: string;
  onGlassTypeChange: (glassTypeId: string | undefined, glassCost: number, glassTypeName: string) => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  quantity?: number;
  productGlassAreaFormula?: GlassFormula;
}

const GlassTypeSelector: React.FC<GlassTypeSelectorProps> = ({
  selectedGlassTypeId,
  onGlassTypeChange,
  disabled = false,
  width = 0,
  height = 0,
  quantity = 1,
  productGlassAreaFormula
}) => {
  const [glassMaterials, setGlassMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculatedArea, setCalculatedArea] = useState<number>(0);
  const [glassDetails, setGlassDetails] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  // Fetch glass materials on component mount
  useEffect(() => {
    const fetchGlassMaterials = async () => {
      try {
        setLoading(true);
        setError(null);
        const materials = await inventoryApi.getGlassMaterials();
        setGlassMaterials(materials); // Backend already filters for isActive: true
      } catch (err: any) {
        setError(err.message || 'Failed to load glass materials');
        setGlassMaterials([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGlassMaterials();
  }, []);

  // Calculate glass area when dimensions or formula change
  useEffect(() => {
    if (productGlassAreaFormula && width > 0 && height > 0) {
      calculateGlassArea();
    } else {
      setCalculatedArea(0);
      setGlassDetails(null);
    }
  }, [width, height, quantity, productGlassAreaFormula]);

  const calculateGlassArea = async () => {
    if (!productGlassAreaFormula || width <= 0 || height <= 0) return;

    setCalculating(true);
    try {
      // Use backend API for accurate calculation with rounding
      const result = await productApi.validateGlassFormula({
        widthFormula: productGlassAreaFormula.widthFormula,
        heightFormula: productGlassAreaFormula.heightFormula,
        glassQuantity: productGlassAreaFormula.glassQuantity,
        inputUnit: productGlassAreaFormula.formulaInputUnit,
        outputUnit: productGlassAreaFormula.outputUnit,
        testDimensions: { width, height }
      });

      if (result.valid && result.testResults && result.testResults.length > 0) {
        const testResult = result.testResults[0];
        setCalculatedArea(testResult.calculatedArea * quantity);
        setGlassDetails(testResult.glassDetails);
      } else {
        // Fallback to simple calculation if API fails
        setCalculatedArea(width * height * quantity / 144); // Basic sqft calculation
        setGlassDetails(null);
      }
    } catch (err) {
      // Fallback calculation
      setCalculatedArea(width * height * quantity / 144);
      setGlassDetails(null);
    } finally {
      setCalculating(false);
    }
  };

  const handleGlassTypeSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const glassTypeId = e.target.value;
    if (!glassTypeId) {
      onGlassTypeChange(undefined, 0, '');
      return;
    }

    const selectedGlass = glassMaterials.find(material => material._id === glassTypeId);
    if (selectedGlass) {
      const rate = typeof selectedGlass.unitRateForStockUnit === 'string' 
        ? parseFloat(selectedGlass.unitRateForStockUnit) 
        : selectedGlass.unitRateForStockUnit;
      
      const cost = calculatedArea * rate;
      
      onGlassTypeChange(glassTypeId, cost, selectedGlass.name);
    }
  };

  // Format currency display
  const formatCurrency = (amount: number): string => {
    return `₹${amount.toFixed(2)}`;
  };

  // Format rate display
  const formatRate = (rate: string | number, unit: string): string => {
    const rateValue = typeof rate === 'string' ? parseFloat(rate) : rate;
    return `${formatCurrency(rateValue)} per ${unit}`;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Glass Type</Label>
        <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-500">
          Loading glass types...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>Glass Type</Label>
        <div className="flex h-10 w-full rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  // Check if product has glass formula
  const hasGlassFormula = productGlassAreaFormula && 
    productGlassAreaFormula.widthFormula?.trim() && 
    productGlassAreaFormula.heightFormula?.trim();

  if (!hasGlassFormula) {
    return null; // Don't show glass selector if product doesn't have glass formula
  }

  const selectedGlass = glassMaterials.find(material => material._id === selectedGlassTypeId);
  const selectedRate = selectedGlass ? 
    (typeof selectedGlass.unitRateForStockUnit === 'string' ? 
      parseFloat(selectedGlass.unitRateForStockUnit) : 
      selectedGlass.unitRateForStockUnit) : 0;
  const totalCost = calculatedArea * selectedRate;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="glassType">
          Glass Type <span className="text-sm text-gray-500">(affects material cost)</span>
        </Label>
        <select
          id="glassType"
          value={selectedGlassTypeId || ''}
          onChange={handleGlassTypeSelection}
          disabled={disabled || glassMaterials.length === 0}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select glass type...</option>
          {glassMaterials.map((material) => (
            <option key={material._id} value={material._id}>
              {material.name} - {formatRate(material.unitRateForStockUnit, material.stockUnit)}
            </option>
          ))}
        </select>
      </div>

      {/* Glass calculation summary */}
      {/* REMOVED BY AI ASSISTANT: User requested to remove this display from estimation form
      {selectedGlassTypeId && calculatedArea > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-1">
          <div className="text-sm">
            <span className="font-medium text-blue-800">
              Glass Calculation {calculating && <span className="text-xs">(Calculating...)</span>}
            </span>
          </div>
          <div className="text-xs text-blue-600 space-y-1">
            <div>Area per item: {(calculatedArea / quantity).toFixed(2)} {productGlassAreaFormula.outputUnit}</div>
            <div>Total area ({quantity} items): {calculatedArea.toFixed(2)} {productGlassAreaFormula.outputUnit}</div>
            <div>Rate: {formatRate(selectedRate, productGlassAreaFormula.outputUnit)}</div>
            
            {glassDetails && (
              <div className="mt-2 pt-2 border-t border-blue-300">
                <div className="text-xs font-medium text-blue-700 mb-1">Glass Cutting Details:</div>
                <div className="space-y-1">
                  <div>Pieces per item: {glassDetails.piecesPerItem}</div>
                  <div>Cut size: {glassDetails.glassCutSize}</div>
                  <div>Total pieces needed: {glassDetails.piecesPerItem * quantity}</div>
                  <div>Area per piece: {glassDetails.areaPerPiece} {productGlassAreaFormula.outputUnit}</div>
                </div>
              </div>
            )}
            
            <div className="font-medium pt-1 border-t border-blue-300">
              Glass Cost: {formatCurrency(totalCost)}
            </div>
          </div>
        </div>
      )}
      */}

      {glassMaterials.length === 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            No glass materials available. Please add glass materials to inventory first.
          </p>
        </div>
      )}
    </div>
  );
};

export default GlassTypeSelector; 