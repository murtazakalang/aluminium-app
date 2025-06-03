import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import Checkbox from '@/components/ui/Checkbox';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Settings, 
  Package, 
  Calculator,
  Eye,
  EyeOff,
  Save,
  Plus,
  FileImage
} from 'lucide-react';
import { productApi, ProductType, Material as ProductMaterialType, GlassFormula, TechnicalDrawing } from '@/lib/api/productService';
import { inventoryApi, Material as InventoryMaterial } from '@/lib/api/inventoryService';
import MaterialFormulaInput from './MaterialFormulaInput';
import GlassFormulaForm from './GlassFormulaForm';
import TechnicalDrawingForm from './TechnicalDrawingForm';

interface ProductFormProps {
  initialData?: ProductType;
  isEdit?: boolean;
}

type SectionId = 'basic' | 'labour' | 'materials' | 'glass' | 'drawing';

interface SectionStatus {
  completed: boolean;
  hasErrors: boolean;
  isOptional: boolean;
}

// Helper function to convert Decimal128 or number/string to string for input
const getDecimalString = (value: any): string => {
  if (typeof value === 'object' && value !== null && value.$numberDecimal !== undefined) {
    return String(value.$numberDecimal);
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }
  return '0.00';
};

// Helper function to properly extract labour cost value
const getLabourCostValue = (labourCost: any): string => {
  if (!labourCost) return '0.00';
  const value = labourCost.value;
  if (value === null || value === undefined) return '0.00';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'object' && value.$numberDecimal !== undefined) {
    return value.$numberDecimal;
  }
  return getDecimalString(value);
};

// Helper function to normalize materials array from initialData
const normalizeInitialMaterials = (materials: any[] | undefined): ProductMaterialType[] => {
  if (!materials) return [];
  return materials.map(mat => {
    const materialIdString = (typeof mat.materialId === 'object' && mat.materialId !== null && mat.materialId._id)
      ? mat.materialId._id
      : mat.materialId;
    return {
      ...mat,
      materialId: materialIdString,
    };
  }).filter(mat => mat.materialId);
};

const ProductForm: React.FC<ProductFormProps> = ({ initialData, isEdit = false }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [inventoryMaterials, setInventoryMaterials] = useState<InventoryMaterial[]>([]);
  
  // Progressive disclosure state
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['basic']));
  const [sectionErrors, setSectionErrors] = useState<Record<SectionId, string | null>>({
    basic: null,
    labour: null,
    materials: null,
    glass: null,
    drawing: null
  });

  const [formData, setFormData] = useState<ProductType>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    imageUrl: initialData?.imageUrl || '',
    isActive: initialData?.isActive ?? true,
    materials: normalizeInitialMaterials(initialData?.materials),
    glassAreaFormula: initialData?.glassAreaFormula,
    technicalDrawing: initialData?.technicalDrawing,
    labourCost: {
      type: initialData?.labourCost?.type || 'fixed',
      value: getLabourCostValue(initialData?.labourCost)
    }
  });
  
  // Load materials from inventory
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const response = await inventoryApi.getAllMaterialsForProducts();
        setInventoryMaterials(response || []);
      } catch (error) {
        try {
          const fallbackResponse = await inventoryApi.getMaterials();
          setInventoryMaterials(fallbackResponse || []);
        } catch (fallbackError) {
          setInventoryMaterials([]);
        }
      }
    };
    
    loadMaterials();
  }, []);

  // Section management
  const toggleSection = (sectionId: SectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getSectionStatus = (sectionId: SectionId): SectionStatus => {
    switch (sectionId) {
      case 'basic':
        return {
          completed: !!(formData.name?.trim()),
          hasErrors: !!sectionErrors.basic,
          isOptional: false
        };
      case 'labour':
        return {
          completed: !!(formData.labourCost?.type && formData.labourCost?.value && parseFloat(formData.labourCost.value) >= 0),
          hasErrors: !!sectionErrors.labour,
          isOptional: false
        };
      case 'materials':
        const hasMaterials = formData.materials && formData.materials.length > 0;
        const allMaterialsValid = hasMaterials && formData.materials.every(mat => 
          mat.materialId && mat.formulas && mat.formulas.length > 0 && mat.formulas.some(f => f.trim())
        );
        return {
          completed: !!allMaterialsValid,
          hasErrors: !!sectionErrors.materials || !!materialsError,
          isOptional: false
        };
      case 'glass':
        return {
          completed: !!formData.glassAreaFormula?.widthFormula && !!formData.glassAreaFormula?.heightFormula,
          hasErrors: !!sectionErrors.glass,
          isOptional: false
        };
      case 'drawing':
        return {
          completed: !!formData.technicalDrawing?.svgContent,
          hasErrors: !!sectionErrors.drawing,
          isOptional: true
        };
      default:
        return { completed: false, hasErrors: false, isOptional: false };
    }
  };

  const getSectionIcon = (sectionId: SectionId, status: SectionStatus) => {
    if (status.hasErrors) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (status.completed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (status.isOptional) {
      return <Clock className="h-4 w-4 text-gray-400" />;
    }
    return <Clock className="h-4 w-4 text-blue-500" />;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value
    }));

    // Clear section errors when user makes changes
    if (name === 'name') {
      setSectionErrors(prev => ({ ...prev, basic: null }));
    }
  };
  
  const handleMaterialsChange = (materials: any[]) => {
    setFormData(prev => ({
      ...prev,
      materials
    }));
    
    // Clear material errors when user makes changes
    if (materialsError) {
      setMaterialsError(null);
    }
    setSectionErrors(prev => ({ ...prev, materials: null }));
  };

  const handleLabourCostChange = (field: 'type' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      labourCost: {
        ...prev.labourCost!,
        [field]: value
      }
    }));
    setSectionErrors(prev => ({ ...prev, labour: null }));
  };

  const handleGlassFormulaChange = (formula: GlassFormula) => {
    setFormData(prev => ({
      ...prev,
      glassAreaFormula: formula
    }));
    setSectionErrors(prev => ({ ...prev, glass: null }));
  };

  const handleTechnicalDrawingChange = (drawing: TechnicalDrawing) => {
    setFormData(prev => ({
      ...prev,
      technicalDrawing: drawing
    }));
    setSectionErrors(prev => ({ ...prev, drawing: null }));
  };
  
  const validateForm = (): boolean => {
    let isValid = true;
    const newSectionErrors: Record<SectionId, string | null> = {
      basic: null,
      labour: null,
      materials: null,
      glass: null,
      drawing: null
    };

    // Validate basic section
    if (!formData.name?.trim()) {
      newSectionErrors.basic = 'Product name is required';
      isValid = false;
    }

    // Validate labour section
    if (!formData.labourCost?.type) {
      newSectionErrors.labour = 'Labour cost type is required';
      isValid = false;
    } else if (!formData.labourCost?.value || parseFloat(formData.labourCost.value) < 0) {
      newSectionErrors.labour = 'Labour cost value must be 0 or greater';
      isValid = false;
    }

    // Validate materials section
    if (!formData.materials || formData.materials.length === 0) {
      setMaterialsError('At least one material is required');
      newSectionErrors.materials = 'At least one material is required';
      isValid = false;
    } else {
      const hasInvalidMaterial = formData.materials.some(mat => !mat.materialId);
      if (hasInvalidMaterial) {
        setMaterialsError('All materials must have a selected material');
        newSectionErrors.materials = 'All materials must have a selected material';
        isValid = false;
      } else {
        const hasEmptyFormula = formData.materials.some(mat => 
          !mat.formulas || mat.formulas.length === 0 || mat.formulas.some(f => !f.trim())
        );
        if (hasEmptyFormula) {
          setMaterialsError('All materials must have at least one non-empty formula');
          newSectionErrors.materials = 'All materials must have at least one non-empty formula';
          isValid = false;
        }
      }
    }

    // Validate glass section
    if (!formData.glassAreaFormula?.widthFormula || !formData.glassAreaFormula?.heightFormula) {
      newSectionErrors.glass = 'Both width and height formulas are required';
      isValid = false;
    }

    // Note: Technical drawing is optional and can be added after product creation
    // No validation required for drawing section

    setSectionErrors(newSectionErrors);
    
    if (!isValid) {
      // Auto-expand sections with errors
      const sectionsWithErrors = Object.keys(newSectionErrors).filter(
        key => newSectionErrors[key as SectionId]
      ) as SectionId[];
      setExpandedSections(prev => new Set([...prev, ...sectionsWithErrors]));
    }

    return isValid;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    setMaterialsError(null);
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      if (isEdit && initialData?._id) {
        await productApi.updateProduct(initialData._id, formData);
      } else {
        await productApi.createProduct(formData);
      }
      
      router.push('/dashboard/products');
      router.refresh();
    } catch (err: any) {
      let errorMessage = 'An error occurred. Please try again.';
      
      if (err.message && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.errors) {
        const errors = err.response.data.errors;
        if (Array.isArray(errors)) {
          errorMessage = errors.join(' ');
        } else if (typeof errors === 'object') {
          const errorMessages = Object.values(errors).map(e => 
            typeof e === 'string' ? e : (e as any).message || ''
          );
          errorMessage = errorMessages.join(' ');
        }
      }
      
      if (errorMessage.toLowerCase().includes('material')) {
        setMaterialsError(errorMessage);
        setSectionErrors(prev => ({ ...prev, materials: errorMessage }));
        setExpandedSections(prev => new Set([...prev, 'materials']));
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const getCompletedSectionsCount = () => {
    const sections: SectionId[] = ['basic', 'labour', 'materials', 'glass', 'drawing'];
    return sections.filter(id => getSectionStatus(id).completed).length;
  };

  const getTotalRequiredSections = () => {
    const sections: SectionId[] = ['basic', 'labour', 'materials', 'glass']; // drawing is optional
    return sections.length;
  };

  const renderSectionHeader = (
    sectionId: SectionId, 
    title: string, 
    description: string,
    icon: React.ReactNode
  ) => {
    const status = getSectionStatus(sectionId);
    const isExpanded = expandedSections.has(sectionId);

    return (
      <div
        className={`flex items-center justify-between p-4 cursor-pointer border rounded-lg transition-all ${
          isExpanded ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}
        onClick={() => toggleSection(sectionId)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {icon}
            {getSectionIcon(sectionId, status)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">{title}</h3>
              {status.isOptional && (
                <Badge variant="outline" className="text-xs">Optional</Badge>
              )}
              {status.hasErrors && (
                <Badge className="bg-red-100 text-red-800 text-xs">Error</Badge>
              )}
              {status.completed && !status.hasErrors && (
                <Badge className="bg-green-100 text-green-800 text-xs">Complete</Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.hasErrors && sectionErrors[sectionId] && (
            <span className="text-sm text-red-600 max-w-xs truncate">
              {sectionErrors[sectionId]}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>
    );
  };

  const renderMaterialSummary = () => {
    if (!formData.materials || formData.materials.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No materials added yet
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {formData.materials.map((material, index) => {
          const hasFormulas = material.formulas && material.formulas.length > 0 && material.formulas.some(f => f.trim());
          const isComplete = material.materialId && hasFormulas;
          
          return (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
              <div className="flex items-center gap-2">
                {isComplete ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  Material #{index + 1}: {material.materialNameSnapshot || 'Not selected'}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {material.materialCategorySnapshot && (
                  <span className="mr-2">{material.materialCategorySnapshot}</span>
                )}
                {hasFormulas ? (
                  <span>{material.formulas.filter(f => f.trim()).length} formula(s)</span>
                ) : (
                  <span className="text-red-500">No formulas</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Progress */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? 'Edit Product' : 'Create New Product'}
            </h1>
            <p className="text-gray-600">
              {formData.name || 'Configure your product step by step'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">
              Progress: {getCompletedSectionsCount()}/{getTotalRequiredSections()} sections completed
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(getCompletedSectionsCount() / getTotalRequiredSections()) * 100}%` 
                }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md border border-red-200 mb-4">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Basic Information Section */}
        <Card>
          {renderSectionHeader(
            'basic',
            'Basic Information',
            'Product name and essential details',
            <Package className="h-4 w-4 text-blue-600" />
          )}
          
          {expandedSections.has('basic') && (
            <div className="p-6 border-t space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="required">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. 2-Track Sliding Window"
                    required
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => {
                      setFormData(prev => ({
                        ...prev,
                        isActive: !!checked
                      }));
                    }}
                  />
                  <Label htmlFor="isActive">Product is active</Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter product description"
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Product Image URL</Label>
                <Input
                  id="imageUrl"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg (optional)"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Labour Cost Section */}
        <Card>
          {renderSectionHeader(
            'labour',
            'Labour Cost',
            'Configure labour charges for this product',
            <Calculator className="h-4 w-4 text-green-600" />
          )}
          
          {expandedSections.has('labour') && (
            <div className="p-6 border-t space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="labourCostType">Labour Cost Type *</Label>
                  <select
                    id="labourCostType"
                    value={formData.labourCost?.type || 'fixed'}
                    onChange={(e) => handleLabourCostChange('type', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="fixed">Fixed (per item)</option>
                    <option value="perSqft">Per Square Foot</option>
                    <option value="perSqm">Per Square Meter</option>
                    <option value="percentage">Percentage of material cost</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="labourCostValue">
                    Labour Cost Value *
                    {formData.labourCost?.type === 'fixed' && ' (₹ per item)'}
                    {formData.labourCost?.type === 'perSqft' && ' (₹ per sqft)'}
                    {formData.labourCost?.type === 'perSqm' && ' (₹ per sqm)'}
                    {formData.labourCost?.type === 'percentage' && ' (%)'}
                  </Label>
                  <Input
                    id="labourCostValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.labourCost?.value || '0.00'}
                    onChange={(e) => handleLabourCostChange('value', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Materials Section */}
        <Card>
          {renderSectionHeader(
            'materials',
            `Materials (${formData.materials?.length || 0} added)`,
            'Add and configure materials with formulas - required for cost calculation',
            <Package className="h-4 w-4 text-purple-600" />
          )}
          
          {/* Always show material summary when collapsed */}
          {!expandedSections.has('materials') && (
            <div className="p-4 border-t bg-gray-50">
              {renderMaterialSummary()}
            </div>
          )}
          
          {expandedSections.has('materials') && (
            <div className="border-t bg-white">
              <div className="p-6">
                <MaterialFormulaInput 
                  value={formData.materials}
                  onChange={handleMaterialsChange}
                  error={materialsError || undefined}
                  materials={inventoryMaterials}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Glass Configuration Section */}
        <Card>
          {renderSectionHeader(
            'glass',
            'Glass Configuration',
            'Configure glass area calculation formulas - required for accurate costing',
            <Eye className="h-4 w-4 text-amber-600" />
          )}
          
          {expandedSections.has('glass') && (
            <div className="border-t bg-white">
              <div className="p-6">
                <GlassFormulaForm 
                  productId={initialData?._id}
                  currentFormula={formData.glassAreaFormula}
                  onSave={handleGlassFormulaChange}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Technical Drawing Section */}
        <Card>
          {renderSectionHeader(
            'drawing',
            'Technical Drawing',
            'Upload or describe the technical drawing for this product',
            <FileImage className="h-4 w-4 text-pink-600" />
          )}
          
          {expandedSections.has('drawing') && (
            <div className="border-t bg-white">
              <div className="p-6">
                <TechnicalDrawingForm 
                  productId={initialData?._id}
                  productName={formData.name}
                  currentDrawing={formData.technicalDrawing}
                  onSave={handleTechnicalDrawingChange}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Form Actions */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex items-center justify-between shadow-lg">
          <div className="text-sm text-gray-600">
            {getCompletedSectionsCount() >= getTotalRequiredSections() ? (
              <span className="text-green-600 font-medium">✓ All sections completed - Ready to save</span>
            ) : (
              <span>Complete {getTotalRequiredSections() - getCompletedSectionsCount()} more section(s) to continue</span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/products')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || getCompletedSectionsCount() < getTotalRequiredSections()}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProductForm; 