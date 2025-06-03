import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { productApi, GlassFormula, GlassFormulaValidationResult } from '@/lib/api/productService';

interface GlassFormulaFormProps {
  productId?: string;
  currentFormula?: GlassFormula;
  onSave: (formula: GlassFormula) => void;
  disabled?: boolean;
}

const GlassFormulaForm: React.FC<GlassFormulaFormProps> = ({
  productId,
  currentFormula,
  onSave,
  disabled = false
}) => {
  const [formula, setFormula] = useState<GlassFormula>(
    currentFormula || {
      widthFormula: '',
      heightFormula: '',
      glassQuantity: 1,
      formulaInputUnit: 'inches',
      outputUnit: 'sqft',
      description: ''
    }
  );
  
  const [validationResult, setValidationResult] = useState<GlassFormulaValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testDimensions, setTestDimensions] = useState({ width: 48, height: 60 });
  const [error, setError] = useState<string | null>(null);

  // Clear validation when formula changes
  useEffect(() => {
    setValidationResult(null);
    setError(null);
  }, [formula.widthFormula, formula.heightFormula, formula.glassQuantity]);

  const handleFormulaChange = (field: keyof GlassFormula, value: string | number) => {
    setFormula(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateFormula = async () => {
    const hasFormula = formula.widthFormula.trim() && formula.heightFormula.trim();

    if (!hasFormula) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const result = await productApi.validateGlassFormula({
        widthFormula: formula.widthFormula,
        heightFormula: formula.heightFormula,
        glassQuantity: formula.glassQuantity,
        inputUnit: formula.formulaInputUnit,
        outputUnit: formula.outputUnit
      });
      setValidationResult(result);
    } catch (err: any) {
      setError(err.message || 'Validation failed');
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  };

  const testFormula = async () => {
    const hasFormula = formula.widthFormula.trim() && formula.heightFormula.trim();

    if (!hasFormula) {
      setError('Please enter formulas to test');
      return;
    }

    setIsTesting(true);
    setError(null);

    try {
      const result = await productApi.validateGlassFormula({
        widthFormula: formula.widthFormula,
        heightFormula: formula.heightFormula,
        glassQuantity: formula.glassQuantity,
        inputUnit: formula.formulaInputUnit,
        outputUnit: formula.outputUnit,
        testDimensions
      });
      
      setValidationResult(result);

    } catch (err: any) {
      setError(err.message || 'Test failed');
      setValidationResult(null);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const hasFormula = formula.widthFormula.trim() && formula.heightFormula.trim();

    if (!validationResult?.valid && hasFormula) {
      setError('Please validate the formulas before saving');
      return;
    }

    onSave(formula);
  };

  const clearFormula = () => {
    setFormula({
      widthFormula: '',
      heightFormula: '',
      glassQuantity: 1,
      formulaInputUnit: 'inches',
      outputUnit: 'sqft',
      description: ''
    });
  };

  const hasValidFormula = formula.widthFormula.trim() && formula.heightFormula.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Glass Area Formula Configuration</h3>
        {hasValidFormula && validationResult?.valid && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Valid Formulas
          </Badge>
        )}
      </div>

      {/* Enhanced Features Notification */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-800">🚀 Enhanced Glass Formula Engine</h4>
            <p className="text-sm text-blue-700 mt-1">
              Factory glass sheet rounding, precise cutting dimensions, and optimized billing calculations.
            </p>
            <ul className="text-xs text-blue-600 mt-2 space-y-1">
              <li>✓ Dimensions automatically rounded to 3" (76.2mm) increments for factory cutting</li>
              <li>✓ Area rounded to 0.25 sqft billing increments for accurate costing</li>
              <li>✓ Separate formulas provide exact glass piece counts and cut sizes</li>
              <li>✓ Compatible with glass placement sheets and supplier ordering</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="font-medium text-blue-800 mb-2">Factory Glass Cutting Optimization</h4>
            <p className="text-sm text-blue-700">
              Separate formulas enable precise glass cutting dimensions with automatic rounding to factory standards:
            </p>
            <ul className="text-xs text-blue-600 mt-1 space-y-1">
              <li>• Dimensions rounded to nearest 3" (76.2mm) increments</li>
              <li>• Area rounded to 0.25 sqft billing increments</li>
              <li>• Exact cut sizes for glass suppliers</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="widthFormula">
                Width Formula <span className="text-sm text-gray-500">(Variables: W = width, H = height)</span>
              </Label>
              <Input
                id="widthFormula"
                value={formula.widthFormula}
                onChange={(e) => handleFormulaChange('widthFormula', e.target.value)}
                placeholder="e.g. (W - 4.75) / 2"
                disabled={disabled}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heightFormula">
                Height Formula <span className="text-sm text-gray-500">(Variables: W = width, H = height)</span>
              </Label>
              <Input
                id="heightFormula"
                value={formula.heightFormula}
                onChange={(e) => handleFormulaChange('heightFormula', e.target.value)}
                placeholder="e.g. H - 5"
                disabled={disabled}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="glassQuantity">Glass Pieces per Item</Label>
              <Input
                id="glassQuantity"
                type="number"
                min="1"
                value={formula.glassQuantity}
                onChange={(e) => handleFormulaChange('glassQuantity', parseInt(e.target.value) || 1)}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500">
                Number of glass pieces needed per window/door (e.g., 2 for 2-track sliding)
              </p>
            </div>
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inputUnit">Input Unit</Label>
              <select
                id="inputUnit"
                value={formula.formulaInputUnit}
                onChange={(e) => handleFormulaChange('formulaInputUnit', e.target.value)}
                disabled={disabled}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="inches">Inches</option>
                <option value="mm">Millimeters</option>
                <option value="ft">Feet</option>
                <option value="m">Meters</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="outputUnit">Output Unit</Label>
              <select
                id="outputUnit"
                value={formula.outputUnit}
                onChange={(e) => handleFormulaChange('outputUnit', e.target.value)}
                disabled={disabled}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="sqft">Square Feet</option>
                <option value="sqm">Square Meters</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={formula.description}
              onChange={(e) => handleFormulaChange('description', e.target.value)}
              placeholder="Explain what this formula calculates..."
              disabled={disabled}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Supports: +, -, *, /, (), Math.max(), Math.min(), Math.ceil(), Math.floor()
            </p>
          </div>
        </div>

        {/* Testing Panel */}
        <div className="space-y-4">
          <Card className="p-4">
            <h4 className="font-medium mb-3">Formula Testing & Validation</h4>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="testWidth">Test Width ({formula.formulaInputUnit})</Label>
                <Input
                  id="testWidth"
                  type="number"
                  value={testDimensions.width}
                  onChange={(e) => setTestDimensions(prev => ({ ...prev, width: Number(e.target.value) }))}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testHeight">Test Height ({formula.formulaInputUnit})</Label>
                <Input
                  id="testHeight"
                  type="number"
                  value={testDimensions.height}
                  onChange={(e) => setTestDimensions(prev => ({ ...prev, height: Number(e.target.value) }))}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={validateFormula}
                disabled={disabled || isValidating || !hasValidFormula}
              >
                {isValidating ? 'Validating...' : 'Validate'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={testFormula}
                disabled={disabled || isTesting || !hasValidFormula}
              >
                {isTesting ? 'Testing...' : 'Test Calculation'}
              </Button>
            </div>

            {validationResult && (
              <div className={`p-3 rounded-md ${validationResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm font-medium ${validationResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                  {validationResult.valid ? 'Formulas are valid!' : 'Formulas have errors'}
                </p>
                {validationResult.error && (
                  <p className="text-sm text-red-600 mt-1">{validationResult.error}</p>
                )}
                
                {validationResult.testResults && validationResult.testResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-sm text-green-700">
                      <p className="font-medium">Calculation Result:</p>
                      <p>Total Area: {validationResult.testResults[0].calculatedArea} {validationResult.testResults[0].unit}</p>
                    </div>
                    
                    {validationResult.testResults[0].glassDetails && (
                      <div className="bg-white border border-green-300 rounded p-2 mt-2">
                        <p className="text-xs font-medium text-green-800 mb-1">Glass Cutting Details:</p>
                        <div className="text-xs text-green-700 space-y-1">
                          <div>Glass Pieces: {validationResult.testResults[0].glassDetails.piecesPerItem ?? 'N/A'} per item</div>
                          <div>Cut Size: {validationResult.testResults[0].glassDetails.glassCutSize ?? 'N/A'}</div>
                          <div>Before Rounding: {validationResult.testResults[0].glassDetails.adjustedWidth?.toFixed(3) ?? 'N/A'}" × {validationResult.testResults[0].glassDetails.adjustedHeight?.toFixed(3) ?? 'N/A'}"</div>
                          <div>After Rounding: {validationResult.testResults[0].glassDetails.roundedWidth ?? 'N/A'}" × {validationResult.testResults[0].glassDetails.roundedHeight ?? 'N/A'}"</div>
                          <div>Area per Piece: {validationResult.testResults[0].glassDetails.areaPerPiece?.toFixed(2) ?? 'N/A'} {validationResult.testResults[0].unit}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </Card>

          {/* Formula Examples */}
          <Card className="p-4">
            <h4 className="font-medium mb-3">Formula Examples</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-700">2-Track Sliding Window:</p>
                  <p className="text-xs text-gray-600">Width: (W - 4.75) / 2</p>
                  <p className="text-xs text-gray-600">Height: H - 5</p>
                  <p className="text-xs text-gray-600">Quantity: 2</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-700">3-Track Sliding Window:</p>
                  <p className="text-xs text-gray-600">Width: (W - 6) / 3</p>
                  <p className="text-xs text-gray-600">Height: H - 5</p>
                  <p className="text-xs text-gray-600">Quantity: 3</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Fixed Window:</p>
                  <p className="text-xs text-gray-600">Width: W - 2</p>
                  <p className="text-xs text-gray-600">Height: H - 2</p>
                  <p className="text-xs text-gray-600">Quantity: 1</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {!disabled && (
        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={clearFormula}
          >
            Clear
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasValidFormula || (!!hasValidFormula && !validationResult?.valid)}
          >
            Save Formulas
          </Button>
        </div>
      )}
    </div>
  );
};

export default GlassFormulaForm; 