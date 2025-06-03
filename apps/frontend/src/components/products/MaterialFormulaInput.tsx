import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, AlertCircle, CheckCircle2, Info, Plus, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { productApi } from '@/lib/api/productService';
import { inventoryApi, Material as InventoryMaterial } from '@/lib/api/inventoryService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useUnits } from '@/contexts/UnitContext';

// Create simple UI components for select, checkbox, and card if they don't exist
// These are based on common Shadcn/UI patterns but simplified

// Select Component - properly implemented with native HTML
const Select = ({ 
  value, 
  onValueChange, 
  disabled, 
  children,
  id
}: { 
  value: string; 
  onValueChange: (value: string) => void; 
  disabled?: boolean;
  children: React.ReactNode;
  id?: string;
}) => {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
};

// We'll replace the unnecessary wrapper components with a simple option component
const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <option value={value}>{children}</option>
);

// Checkbox Component
const Checkbox = ({ 
  id, 
  checked, 
  onCheckedChange 
}: { 
  id?: string; 
  checked?: boolean; 
  onCheckedChange: (checked: boolean) => void 
}) => {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
    />
  );
};

interface MaterialInputValue {
  materialId: string;
  materialNameSnapshot?: string;
  materialCategorySnapshot?: string;
  gaugeOptionsSnapshot?: Array<{
    gauge: string;
    weightPerUnitLength: number;
    unitLength: string;
    weightUnit: string;
  }>;
  formulas: string[];
  formulaInputUnit: 'inches' | 'mm' | 'ft' | 'm';
  quantityUnit: 'ft' | 'inches' | 'mm' | 'sqft' | 'sqm' | 'pcs' | 'kg';
  isCutRequired: boolean;
  defaultGauge?: string;
}

interface MaterialFormulaInputProps {
  value: MaterialInputValue[];
  onChange: (materials: MaterialInputValue[]) => void;
  error?: string;
  materials: InventoryMaterial[];
}

const FORMULA_TEMPLATES = {
  Profile: [
    { label: 'Width - 2mm', formula: 'W-2', description: 'Width minus 2mm clearance' },
    { label: 'Height - 1.5mm', formula: 'H-1.5', description: 'Height minus 1.5mm clearance' },
    { label: 'Width + Height', formula: 'W+H', description: 'Perimeter calculation' },
    { label: 'Width × 2', formula: 'W*2', description: 'Double width' },
    { label: 'Height × 2', formula: 'H*2', description: 'Double height' },
  ],
  Glass: [
    { label: 'Width - 4mm', formula: 'W-4', description: 'Width minus frame clearance' },
    { label: 'Height - 4mm', formula: 'H-4', description: 'Height minus frame clearance' },
    { label: 'Area (W×H)', formula: 'W*H', description: 'Glass area calculation' },
    { label: 'Width - 6mm', formula: 'W-6', description: 'Width minus 6mm clearance' },
    { label: 'Height - 6mm', formula: 'H-6', description: 'Height minus 6mm clearance' },
  ],
  Hardware: [
    { label: 'Fixed Quantity (1)', formula: '1', description: 'One piece per window' },
    { label: 'Fixed Quantity (2)', formula: '2', description: 'Two pieces per window' },
    { label: 'Width ÷ 100', formula: 'W/100', description: 'Per 100mm of width' },
    { label: 'Height ÷ 100', formula: 'H/100', description: 'Per 100mm of height' },
  ]
};

// Tooltip component for formula hints
const FormulaHint = () => (
  <div className="relative group">
    <Info className="h-4 w-4 text-blue-500 cursor-help" />
    <div className="hidden group-hover:block absolute z-10 bg-white p-2 rounded shadow-lg border left-6 -top-2 w-56 text-xs">
      <strong>Formula Tip:</strong> If you enter multiple formulas separated by commas (e.g., "W,(H-1.5)"), they will be automatically split into separate entries.
    </div>
  </div>
);

const MaterialFormulaInput: React.FC<MaterialFormulaInputProps> = ({ 
  value, 
  onChange,
  error,
  materials
}) => {
  const [loading, setLoading] = useState(false);
  const [formulaValidations, setFormulaValidations] = useState<Record<string, {valid: boolean, error?: string}>>({});
  const [showSplitNotification, setShowSplitNotification] = useState<{materialIndex: number, message: string} | null>(null);
  const { getDefaultFormulaInputUnit, dimensionUnit, isUnitLoading } = useUnits();
  
  // Individual material expansion state - each material can be collapsed/expanded independently
  const [expandedMaterials, setExpandedMaterials] = useState<Set<number>>(new Set());
  
  useEffect(() => {
    // Load available materials from inventory
    const fetchMaterials = async () => {
      setLoading(true);
      try {
        const response = await inventoryApi.getMaterials();
      } catch (error) {
        // Error loading materials
      } finally {
        setLoading(false);
      }
    };
    
    fetchMaterials();
  }, []);
  
  useEffect(() => {
    if (materials && Array.isArray(materials)) {
      // Materials state updated
    } else {
      // Materials is undefined or not an array
    }
  }, [materials]);

  useEffect(() => {
    if (value && Array.isArray(value)) {
      // Value prop updated (product materials)
    } else {
      // Value is undefined or not an array
    }
  }, [value]);

  const toggleMaterialExpansion = (index: number) => {
    const newExpanded = new Set(expandedMaterials);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMaterials(newExpanded);
  };

  const addMaterial = () => {
    const newMaterial: MaterialInputValue = {
      materialId: '',
      formulas: [''],
      formulaInputUnit: getDefaultFormulaInputUnit() as any,
      quantityUnit: 'ft',
      isCutRequired: false
    };
    const newMaterials = [...value, newMaterial];
    onChange(newMaterials);
    
    // Auto-expand newly added material
    setExpandedMaterials(prev => new Set([...prev, newMaterials.length - 1]));
  };

  const removeMaterial = (index: number) => {
    const newMaterials = value.filter((_, i) => i !== index);
    onChange(newMaterials);
    
    // Update expanded materials indices
    const newExpanded = new Set<number>();
    expandedMaterials.forEach(expandedIndex => {
      if (expandedIndex < index) {
        newExpanded.add(expandedIndex);
      } else if (expandedIndex > index) {
        newExpanded.add(expandedIndex - 1);
      }
    });
    setExpandedMaterials(newExpanded);
  };

  const updateMaterial = (index: number, field: keyof MaterialInputValue, newValue: any) => {
    const newMaterials = [...value];
    
    // If updating materialId, fetch and set the material details
    if (field === 'materialId') {
      const selectedMaterial = materials && Array.isArray(materials) ? materials.find(mat => mat._id === newValue) : null;
      
      if (selectedMaterial) {
        newMaterials[index] = {
          ...newMaterials[index],
          materialId: selectedMaterial._id,
          materialNameSnapshot: selectedMaterial.name,
          materialCategorySnapshot: selectedMaterial.category,
          gaugeOptionsSnapshot: selectedMaterial.gaugeSpecificWeights?.map(gauge => {
            // Handle both string/number and Decimal128 values
            const getDecimalValue = (value: any): number => {
              if (typeof value === 'string' || typeof value === 'number') {
                return parseFloat(value.toString());
              }
              if (value && typeof value === 'object' && value.$numberDecimal) {
                return parseFloat(value.$numberDecimal);
              }
              return 0;
            };
            
            return {
              gauge: gauge.gauge,
              weightPerUnitLength: getDecimalValue(gauge.weightPerUnitLength),
              unitLength: gauge.unitLength?.toString() || 'ft',
              weightUnit: selectedMaterial.weightUnit || 'kg'
            };
          }) || [],
          quantityUnit: selectedMaterial.usageUnit, // Always use material's usage unit
          isCutRequired: selectedMaterial.category === 'Profile', // Default to true for Profile
          formulaInputUnit: getDefaultFormulaInputUnit(), // Always use global setting
        };
        
        // Auto-expand the material when selected
        setExpandedMaterials(prev => new Set([...prev, index]));
      } else {
        // If material not found in current `materials` list, still update ID and clear related fields
        newMaterials[index] = {
            ...newMaterials[index],
            materialId: newValue,
            materialNameSnapshot: '' , // Clear snapshot if material not found
            materialCategorySnapshot: undefined,
            gaugeOptionsSnapshot: [],
            quantityUnit: 'pcs', // Default or clear
            isCutRequired: false,
            formulaInputUnit: getDefaultFormulaInputUnit(), // Always use global setting
        };
      }
    } else {
      newMaterials[index] = {
        ...newMaterials[index],
        [field]: newValue
      };
    }
    
    onChange(newMaterials);
  };

  const addFormula = (materialIndex: number) => {
    const newMaterials = [...value];
    newMaterials[materialIndex].formulas.push('');
    onChange(newMaterials);
  };

  const insertFormulaTemplate = (materialIndex: number, formulaIndex: number, template: string) => {
    const newMaterials = [...value];
    newMaterials[materialIndex].formulas[formulaIndex] = template;
    onChange(newMaterials);
  };

  /**
   * Handles updates to formula inputs with automatic comma splitting
   */
  const handleUpdateFormulaWithSplit = (materialIndex: number, formulaIndex: number, newFormulaValue: string) => {
    // Check if the formula contains commas (which would cause validation errors)
    if (newFormulaValue.includes(',')) {
      // Split the formula by commas
      const formulaParts = newFormulaValue.split(',')
        .map(part => part.trim()) // Trim whitespace
        .filter(part => part.length > 0); // Remove empty parts
      
      if (formulaParts.length > 1) {
        // Create a deep copy of the materials array
        const newMaterials = [...value];
        
        // Replace the current formula with the first part
        newMaterials[materialIndex].formulas[formulaIndex] = formulaParts[0];
        
        // Add the remaining parts as new formulas
        for (let i = 1; i < formulaParts.length; i++) {
          newMaterials[materialIndex].formulas.splice(formulaIndex + i, 0, formulaParts[i]);
        }
        
        // Update the state
        onChange(newMaterials);
        
        // Show a notification that formulas were split
        setShowSplitNotification({
          materialIndex,
          message: `Automatically split comma-separated formulas into ${formulaParts.length} entries.`
        });
        
        // Clear the notification after 5 seconds
        setTimeout(() => {
          setShowSplitNotification(null);
        }, 5000);
        
        return;
      }
    }
    
    // No commas found or only one part after splitting, update normally
    updateFormula(materialIndex, formulaIndex, newFormulaValue);
  };
  
  const updateFormula = (materialIndex: number, formulaIndex: number, newFormula: string) => {
    const newMaterials = [...value];
    newMaterials[materialIndex].formulas[formulaIndex] = newFormula;
    onChange(newMaterials);
    
    // Invalidate existing validation for this formula
    const key = `${materialIndex}-${formulaIndex}`;
    if (formulaValidations[key]) {
      const newValidations = {...formulaValidations};
      delete newValidations[key];
      setFormulaValidations(newValidations);
    }
  };
  
  const removeFormula = (materialIndex: number, formulaIndex: number) => {
    const newMaterials = [...value];
    newMaterials[materialIndex].formulas.splice(formulaIndex, 1);
    if (newMaterials[materialIndex].formulas.length === 0) {
      newMaterials[materialIndex].formulas.push(''); // Always keep at least one formula
    }
    onChange(newMaterials);
  };
  
  const validateFormula = async (materialIndex: number, formulaIndex: number) => {
    const formula = value[materialIndex].formulas[formulaIndex];
    if (!formula) return;
    
    const key = `${materialIndex}-${formulaIndex}`;
    
    try {
      const result = await productApi.validateFormula(formula);
      setFormulaValidations(prev => ({
        ...prev,
        [key]: result
      }));
    } catch (error) {
      setFormulaValidations(prev => ({
        ...prev,
        [key]: { valid: false, error: 'Error validating formula' }
      }));
    }
  };
  
  const getFormulaInputUnitDisplay = () => {
    if (isUnitLoading) return 'Loading...';
    return getDefaultFormulaInputUnit();
  };

  return (
    <div className="space-y-4">
      {/* Simple Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Materials</h3>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded border border-red-200 text-sm">
          {error}
        </div>
      )}
      
      {value.length === 0 && (
        <div className="text-center p-8 border border-dashed rounded-md bg-gray-50">
          <Plus className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 mb-4">No materials added yet</p>
          <Button type="button" onClick={addMaterial} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Material
          </Button>
        </div>
      )}
      
      {value.map((mat, index) => {
        
        const selectedMaterialDetails = materials && Array.isArray(materials) ? materials.find(m => m._id === mat.materialId) : null;
        
        const materialMissing = mat.materialId && !selectedMaterialDetails;
        const isExpanded = expandedMaterials.has(index);

        return (
          <Card key={index} className={`transition-all duration-200 ${isExpanded ? 'ring-2 ring-blue-200' : ''}`}>
            <CardContent className="pt-4">
              {/* Material Header - Always Visible */}
              <div className="flex justify-between items-center mb-4">
                <div 
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => toggleMaterialExpansion(index)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? 
                      <ChevronDown className="h-5 w-5 text-gray-400" /> : 
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    }
                    <h4 className="font-semibold text-md">Material #{index + 1}</h4>
                  </div>
                  {mat.materialNameSnapshot && (
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {mat.materialNameSnapshot}
                    </span>
                  )}
                  {selectedMaterialDetails && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {selectedMaterialDetails.category}
                    </span>
                  )}
                </div>
                <Button 
                  type="button" 
                  onClick={() => removeMaterial(index)} 
                  variant="ghost" 
                  size="sm" 
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Compact Summary when collapsed */}
              {!isExpanded && (
                <div className="p-3 bg-gray-50 rounded text-sm text-gray-600 cursor-pointer" onClick={() => toggleMaterialExpansion(index)}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {materialMissing && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {!mat.materialId && <span className="text-red-500">No material selected</span>}
                      {selectedMaterialDetails && (
                        <>
                          <span>{selectedMaterialDetails.category}</span>
                          <span>•</span>
                          <span>{mat.formulas.filter(f => f.trim()).length} formula(s)</span>
                          {mat.formulas.filter(f => f.trim()).length === 0 && (
                            <span className="text-red-500">• No formulas</span>
                          )}
                        </>
                      )}
                    </div>
                    <span className="text-xs text-blue-600">Click to expand</span>
                  </div>
                </div>
              )}

              {/* Expanded Content */}
              {isExpanded && (
                <div className="space-y-4">
                  {/* Material Selection */}
                  <div className="space-y-2">
                    <Label htmlFor={`material-select-${index}`}>Select Material</Label>
                    <div className="text-xs text-gray-500 mb-1">
                      Materials available: {materials ? materials.length : 0} 
                      {loading && ' (Loading...)'}
                    </div>
                    <Select
                      id={`material-select-${index}`}
                      value={mat.materialId || ''} // Handle null/undefined mat.materialId
                      onValueChange={(newId) => updateMaterial(index, 'materialId', newId)}
                      disabled={loading || !materials || !materials.length} // Disable if materials not loaded
                    >
                      <SelectItem value="">-- Select a Material --</SelectItem>
                      {materials && materials.map(m => (
                        <SelectItem key={m._id} value={m._id}>
                          {m.name} ({m.category} - {m.stockUnit}){m.isActive ? '' : ' (Inactive)'}
                        </SelectItem>
                      ))}
                    </Select>
                    {materialMissing && (
                      <div className="mt-1 flex items-center text-sm text-yellow-600">
                        <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>This material is no longer available. Please select a replacement or remove it.</span>
                      </div>
                    )}
                    {mat.materialId && selectedMaterialDetails && (
                       <div className="mt-1 text-xs text-gray-500">
                          Category: {selectedMaterialDetails.category}, Usage Unit: {selectedMaterialDetails.usageUnit}
                       </div>
                    )}
                  </div>
                  
                  {/* Material Configuration - Only show if material is selected */}
                  {selectedMaterialDetails && (
                    <>
                      {selectedMaterialDetails.category !== 'Profile' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`formulaInputUnit-${index}`}>Formula Input Unit</Label>
                            <div className="text-xs text-gray-500 mb-1">
                              Unit for W and H variables in formulas
                            </div>
                            <Select
                              id={`formulaInputUnit-${index}`}
                              value={mat.formulaInputUnit}
                              onValueChange={(value) => updateMaterial(index, 'formulaInputUnit', value)}
                            >
                              <SelectItem value="inches">Inches</SelectItem>
                              <SelectItem value="mm">Millimeters</SelectItem>
                              <SelectItem value="ft">Feet</SelectItem>
                              <SelectItem value="m">Meters</SelectItem>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor={`quantityUnit-${index}`}>Quantity Unit</Label>
                            <div className="text-xs text-gray-500 mb-1">
                              Final unit for calculated quantities
                            </div>
                            <Select
                              id={`quantityUnit-${index}`}
                              value={mat.quantityUnit}
                              onValueChange={(value) => updateMaterial(index, 'quantityUnit', value)}
                            >
                              <SelectItem value="ft">Feet</SelectItem>
                              <SelectItem value="inches">Inches</SelectItem>
                              <SelectItem value="mm">Millimeters</SelectItem>
                              <SelectItem value="sqft">Square Feet</SelectItem>
                              <SelectItem value="sqm">Square Meters</SelectItem>
                              <SelectItem value="pcs">Pieces</SelectItem>
                              <SelectItem value="kg">Kilograms</SelectItem>
                            </Select>
                          </div>
                        </div>
                      )}
                      
                      {selectedMaterialDetails.category === 'Profile' && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="text-sm text-blue-700">
                            <strong>Profile Material Settings:</strong>
                            <br />
                            • Formula Input Unit: <strong>{getDefaultFormulaInputUnit()}</strong> (from General Settings)
                            <br />
                            • Quantity Unit: <strong>{selectedMaterialDetails.usageUnit}</strong> (from Material Settings)
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`isCutRequired-${index}`}
                          checked={mat.isCutRequired}
                          onCheckedChange={(checked) => 
                            updateMaterial(index, 'isCutRequired', checked)
                          }
                        />
                        <Label htmlFor={`isCutRequired-${index}`}>Requires Cutting</Label>
                      </div>
                      
                      {mat.materialCategorySnapshot === 'Profile' && (
                        <div>
                          <Label htmlFor={`defaultGauge-${index}`}>Default Gauge</Label>
                          {mat.gaugeOptionsSnapshot && mat.gaugeOptionsSnapshot.length > 0 ? (
                            <Select
                              value={mat.defaultGauge || ''}
                              onValueChange={(val) => updateMaterial(index, 'defaultGauge', val)}
                              id={`defaultGauge-${index}`}
                            >
                              <SelectItem value="">-- Select Gauge --</SelectItem>
                              {mat.gaugeOptionsSnapshot.map((gaugeInfo, gaugeIndex) => (
                                <SelectItem key={gaugeIndex} value={gaugeInfo.gauge}>
                                  {gaugeInfo.gauge} ({gaugeInfo.weightPerUnitLength.toFixed(3)} {gaugeInfo.weightUnit}/{gaugeInfo.unitLength})
                                </SelectItem>
                              ))}
                            </Select>
                          ) : (
                            <div className="space-y-2">
                              <Input
                                id={`defaultGauge-${index}`}
                                value={mat.defaultGauge || ''}
                                onChange={(e) => updateMaterial(index, 'defaultGauge', e.target.value)}
                                placeholder="e.g. 1.2mm"
                              />
                              <p className="text-xs text-gray-500">
                                No gauges defined for this material. Add gauges to the material inventory for dropdown selection.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Enhanced Formula Section */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <Label>Formulas</Label>
                            <span className="ml-2"><FormulaHint /></span>
                          </div>
                          <Button 
                            type="button" 
                            onClick={() => addFormula(index)} 
                            variant="outline" 
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Formula
                          </Button>
                        </div>

                        {/* Formula Templates */}
                        {mat.materialCategorySnapshot && FORMULA_TEMPLATES[mat.materialCategorySnapshot as keyof typeof FORMULA_TEMPLATES] && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-amber-600" />
                              <span className="text-sm font-medium text-amber-800">Quick Templates for {mat.materialCategorySnapshot}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {FORMULA_TEMPLATES[mat.materialCategorySnapshot as keyof typeof FORMULA_TEMPLATES].map((template, templateIndex) => (
                                <Button
                                  key={templateIndex}
                                  type="button"
                                  onClick={() => {
                                    // Insert template into the first empty formula or add new one
                                    const emptyFormulaIndex = mat.formulas.findIndex(f => !f.trim());
                                    if (emptyFormulaIndex !== -1) {
                                      insertFormulaTemplate(index, emptyFormulaIndex, template.formula);
                                    } else {
                                      addFormula(index);
                                      // Wait for state update, then insert template
                                      setTimeout(() => {
                                        insertFormulaTemplate(index, mat.formulas.length - 1, template.formula);
                                      }, 0);
                                    }
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-6 px-2"
                                  title={template.description}
                                >
                                  {template.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {showSplitNotification && showSplitNotification.materialIndex === index && (
                          <div className="text-sm p-2 bg-blue-50 text-blue-700 rounded border border-blue-200 mb-2">
                            <div className="flex items-center">
                              <Info className="h-4 w-4 mr-1" />
                              {showSplitNotification.message}
                            </div>
                          </div>
                        )}
                        
                        {mat.formulas.map((formula, formulaIndex) => {
                          const validationKey = `${index}-${formulaIndex}`;
                          const validation = formulaValidations[validationKey];
                          
                          return (
                            <div key={formulaIndex} className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="relative">
                                  <Input
                                    value={formula}
                                    onChange={(e) => 
                                      handleUpdateFormulaWithSplit(index, formulaIndex, e.target.value)
                                    }
                                    placeholder="e.g. W - 2"
                                  />
                                  {validation && (
                                    <div className="absolute right-0 top-0 h-full flex items-center pr-2">
                                      {validation.valid ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                      )}
                                    </div>
                                  )}
                                </div>
                                {validation && !validation.valid && (
                                  <p className="text-xs text-red-500 mt-1">{validation.error}</p>
                                )}
                                {formulaIndex === 0 && (
                                  <p className="text-xs text-gray-500 mt-1">Use separate formula entries for multiple quantities. Commas will be automatically split.</p>
                                )}
                              </div>
                              
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => validateFormula(index, formulaIndex)}
                              >
                                Validate
                              </Button>
                              
                              {mat.formulas.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFormula(index, formulaIndex)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      
      {/* Add Material Button at Bottom */}
      {value.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button type="button" onClick={addMaterial} variant="outline" className="w-full max-w-xs">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Material
          </Button>
        </div>
      )}
    </div>
  );
};

export default MaterialFormulaInput; 