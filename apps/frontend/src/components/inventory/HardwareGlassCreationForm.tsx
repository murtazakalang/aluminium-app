'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormInput } from '@/components/ui/FormInput';
import { Badge } from '@/components/ui/Badge';
import { Loader2, AlertCircle, Package, Wrench, ShieldCheck, Settings, Zap, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { batchInventoryApi, SimplifiedMaterialData } from '@/lib/api/batchInventoryService';
import { toast } from 'sonner';

interface HardwareGlassCreationFormProps {
  onClose: () => void;
  onSuccess: (material: any) => void;
}

type MaterialCategory = 'Hardware' | 'Glass' | 'Wire Mesh' | 'Accessories' | 'Consumables';

const categoryConfig = {
  'Hardware': {
    icon: Wrench,
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-200',
    examples: 'Handles, Locks, Hinges, Fasteners',
    description: 'Mechanical components and fasteners for doors and windows',
    stockUnits: [
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'sets', label: 'Sets' },
      { value: 'pairs', label: 'Pairs' },
      { value: 'kg', label: 'Kilograms (kg)' },
      { value: 'packets', label: 'Packets' }
    ],
    usageUnits: [
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'sets', label: 'Sets' },
      { value: 'pairs', label: 'Pairs' },
      { value: 'kg', label: 'Kilograms (kg)' }
    ],
    defaultStock: 'pcs',
    defaultUsage: 'pcs'
  },
  'Glass': {
    icon: Package,
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-200',
    examples: '5mm Clear Glass, Frosted Glass, Tempered Glass',
    description: 'Glass panels, sheets, and glazing materials',
    stockUnits: [
      { value: 'sqft', label: 'Square Feet (sqft)' },
      { value: 'sqm', label: 'Square Meters (sqm)' },
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'kg', label: 'Kilograms (kg)' }
    ],
    usageUnits: [
      { value: 'sqft', label: 'Square Feet (sqft)' },
      { value: 'sqm', label: 'Square Meters (sqm)' },
      { value: 'pcs', label: 'Pieces (pcs)' }
    ],
    defaultStock: 'sqft',
    defaultUsage: 'sqft'
  },
  'Wire Mesh': {
    icon: ShieldCheck,
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    examples: 'Mosquito Mesh, Security Mesh, Fly Screen, Stainless Steel Mesh',
    description: 'Wire mesh, security grills, and screening materials',
    stockUnits: [
      { value: 'sqft', label: 'Square Feet (sqft)' },
      { value: 'sqm', label: 'Square Meters (sqm)' },
      { value: 'meter', label: 'Meters' },
      { value: 'rolls', label: 'Rolls' }
    ],
    usageUnits: [
      { value: 'sqft', label: 'Square Feet (sqft)' },
      { value: 'sqm', label: 'Square Meters (sqm)' },
      { value: 'meter', label: 'Meters' }
    ],
    defaultStock: 'sqft',
    defaultUsage: 'sqft'
  },
  'Accessories': {
    icon: Settings,
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-200',
    examples: 'Rubber Seals, Gaskets, Weather Strips',
    description: 'Supporting materials and accessories',
    stockUnits: [
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'meter', label: 'Meters' },
      { value: 'rolls', label: 'Rolls' },
      { value: 'kg', label: 'Kilograms (kg)' },
      { value: 'packets', label: 'Packets' }
    ],
    usageUnits: [
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'meter', label: 'Meters' },
      { value: 'kg', label: 'Kilograms (kg)' }
    ],
    defaultStock: 'pcs',
    defaultUsage: 'pcs'
  },
  'Consumables': {
    icon: Zap,
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-200',
    examples: 'Screws, Silicone, Adhesives, Cleaning Supplies',
    description: 'Consumable materials and supplies',
    stockUnits: [
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'kg', label: 'Kilograms (kg)' },
      { value: 'liters', label: 'Liters' },
      { value: 'packets', label: 'Packets' },
      { value: 'tubes', label: 'Tubes' }
    ],
    usageUnits: [
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'kg', label: 'Kilograms (kg)' },
      { value: 'ml', label: 'Milliliters (ml)' }
    ],
    defaultStock: 'pcs',
    defaultUsage: 'pcs'
  }
};

const HardwareGlassCreationForm: React.FC<HardwareGlassCreationFormProps> = ({
  onClose,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | null>(null);
  const [formData, setFormData] = useState<Partial<SimplifiedMaterialData>>({
    name: '',
    category: undefined,
    stockUnit: '',
    usageUnit: '',
    standardLengths: [],
    supplier: '',
    brand: '',
    hsnCode: '',
    description: ''
  });

  const handleCategorySelect = (category: MaterialCategory) => {
    const config = categoryConfig[category];
    setSelectedCategory(category);
    setFormData(prev => ({
      ...prev,
      category,
      stockUnit: config.defaultStock,
      usageUnit: config.defaultUsage
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Standard lengths management for Wire Mesh
  const addStandardLength = () => {
    setFormData(prev => ({
      ...prev,
      standardLengths: [
        ...(prev.standardLengths || []),
        { length: 2, unit: 'ft' }
      ]
    }));
  };

  const removeStandardLength = (index: number) => {
    setFormData(prev => ({
      ...prev,
      standardLengths: prev.standardLengths?.filter((_, i) => i !== index) || []
    }));
  };

  const updateStandardLength = (index: number, field: 'length' | 'unit', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      standardLengths: prev.standardLengths?.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ) || []
    }));
  };

  const importStandardWidths = () => {
    const standardWidths = [
      { length: 2, unit: 'ft' },
      { length: 2.5, unit: 'ft' },
      { length: 3, unit: 'ft' },
      { length: 3.5, unit: 'ft' },
      { length: 4, unit: 'ft' },
      { length: 5, unit: 'ft' }
    ];
    
    setFormData(prev => ({
      ...prev,
      standardLengths: standardWidths
    }));
    
    toast.success('Standard widths imported successfully!');
  };

  const validateForm = (): string | null => {
    if (!selectedCategory) return 'Please select a material category';
    if (!formData.name?.trim()) return 'Material name is required';
    if (!formData.stockUnit) return 'Stock unit is required';
    if (!formData.usageUnit) return 'Usage unit is required';

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsLoading(true);
    
    try {
      const materialData: SimplifiedMaterialData = {
        name: formData.name!.trim(),
        category: formData.category!,
        stockUnit: formData.stockUnit!,
        usageUnit: formData.usageUnit!,
        standardLengths: formData.standardLengths || [], // Use user-defined standard lengths
        gauges: [], // Hardware and Glass don't typically need gauges
        supplier: formData.supplier?.trim() || undefined,
        brand: formData.brand?.trim() || undefined,
        hsnCode: formData.hsnCode?.trim() || undefined,
        description: formData.description?.trim() || undefined
      };

      const response = await batchInventoryApi.createSimplifiedMaterial(materialData);
      
      toast.success(`${formData.category} material "${formData.name}" created successfully!`);
      onSuccess(response.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create material');
    } finally {
      setIsLoading(false);
      setFormData({
        name: '',
        category: undefined,
        stockUnit: '',
        usageUnit: '',
        standardLengths: [],
        supplier: '',
        brand: '',
        hsnCode: '',
        description: ''
      });
    }
  };

  const currentConfig = selectedCategory ? categoryConfig[selectedCategory] : null;
  const IconComponent = currentConfig?.icon || Package;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-purple-600" />
            <div>
              <h2 className="text-xl font-semibold">Create Hardware & Glass Materials</h2>
              <p className="text-sm text-gray-600">Create specialized materials for hardware, glass, wire mesh, accessories, and consumables</p>
            </div>
            <Badge className="bg-purple-100 text-purple-800">Quick Setup</Badge>
          </div>
        </div>
      </Card>

      {/* Category Selection */}
      {!selectedCategory && (
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Select Material Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.entries(categoryConfig) as [MaterialCategory, any][]).map(([category, config]) => {
              const IconComp = config.icon;
              return (
                <Button
                  key={category}
                  onClick={() => handleCategorySelect(category)}
                  variant="outline"
                  className={`h-auto p-4 flex flex-col items-start text-left space-y-2 hover:${config.bgColor} hover:${config.borderColor}`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <IconComp className={`h-5 w-5 text-${config.color}-600`} />
                    <span className="font-medium">{category}</span>
                  </div>
                  <p className="text-xs text-gray-600">{config.examples}</p>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </Button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Form */}
      {selectedCategory && currentConfig && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <IconComponent className={`h-6 w-6 text-${currentConfig.color}-600`} />
              <div>
                <h3 className="text-lg font-semibold">Create {selectedCategory} Material</h3>
                <p className="text-sm text-gray-600">{currentConfig.description}</p>
              </div>
              <Badge className={`${currentConfig.bgColor} ${currentConfig.textColor}`}>
                {selectedCategory}
              </Badge>
            </div>
            <Button
              onClick={() => {
                setSelectedCategory(null);
                setFormData({
                  name: '',
                  category: undefined,
                  stockUnit: '',
                  usageUnit: '',
                  standardLengths: [],
                  supplier: '',
                  brand: '',
                  hsnCode: '',
                  description: ''
                });
              }}
              variant="outline"
              size="sm"
            >
              Change Category
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-md font-medium mb-4">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  id="name"
                  name="name"
                  label="Material Name *"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  placeholder={`e.g., ${currentConfig.examples.split(',')[0].trim()}`}
                  required
                />

                <div>
                  <label className="block text-sm font-medium mb-1">Stock Unit *</label>
                  <select
                    name="stockUnit"
                    value={formData.stockUnit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {currentConfig.stockUnits.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Usage Unit *</label>
                  <select
                    name="usageUnit"
                    value={formData.usageUnit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {currentConfig.usageUnits.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Supplier Information */}
            <div>
              <h4 className="text-md font-medium mb-4">Supplier Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput
                  id="supplier"
                  name="supplier"
                  label="Default Supplier"
                  value={formData.supplier || ''}
                  onChange={handleInputChange}
                  placeholder="Supplier name"
                />
                
                <FormInput
                  id="brand"
                  name="brand"
                  label="Brand"
                  value={formData.brand || ''}
                  onChange={handleInputChange}
                  placeholder="Brand name"
                />
                
                <FormInput
                  id="hsnCode"
                  name="hsnCode"
                  label="HSN Code"
                  value={formData.hsnCode || ''}
                  onChange={handleInputChange}
                  placeholder="HSN code"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Detailed description of the ${selectedCategory.toLowerCase()} material...`}
              />
            </div>

            {/* Wire Mesh Standard Widths */}
            {selectedCategory === 'Wire Mesh' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-medium">
                    Standard Widths
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={importStandardWidths}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <Package className="h-4 w-4" />
                      Import Standard Widths
                    </Button>
                    <Button
                      type="button"
                      onClick={addStandardLength}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Width
                    </Button>
                  </div>
                </div>
                
                {formData.standardLengths && formData.standardLengths.length > 0 ? (
                  <div className="space-y-2">
                    {formData.standardLengths.map((length, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="number"
                          value={length.length}
                          onChange={(e) => updateStandardLength(index, 'length', parseFloat(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Width"
                          min="0"
                          step="0.1"
                        />
                        <select
                          value={length.unit}
                          onChange={(e) => updateStandardLength(index, 'unit', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ft">ft</option>
                          <option value="m">m</option>
                        </select>
                        <Button
                          type="button"
                          onClick={() => removeStandardLength(index)}
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium mb-1">No standard widths configured</p>
                    <p className="text-sm mb-4">Add standard widths manually or import the common sizes (2ft, 2.5ft, 3ft, 3.5ft, 4ft, 5ft)</p>
                    <div className="flex justify-center gap-2">
                      <Button
                        type="button"
                        onClick={importStandardWidths}
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                      >
                        <Package className="h-4 w-4 mr-1" />
                        Import Standard Widths
                      </Button>
                      <Button
                        type="button"
                        onClick={addStandardLength}
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Custom Width
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info Panel */}
            <div className={`${currentConfig.bgColor} ${currentConfig.borderColor} border rounded-lg p-4`}>
              <div className="flex items-start gap-2">
                <AlertCircle className={`h-5 w-5 text-${currentConfig.color}-600 mt-0.5`} />
                <div className={`text-sm ${currentConfig.textColor}`}>
                  <p className="font-medium mb-1">
                    {selectedCategory} Material Setup
                  </p>
                  <p>
                    {selectedCategory === 'Glass' ? 
                      'This will create a glass material for use in windows and doors. You can specify dimensions during stock entry.' :
                      selectedCategory === 'Wire Mesh' ?
                      'This will create a wire mesh material for security or screening purposes. You can add standard widths manually or use the "Import Standard Widths" button to quickly add common sizes (2ft, 2.5ft, 3ft, 3.5ft, 4ft, 5ft) for optimization.' :
                      selectedCategory === 'Hardware' ?
                      'This will create a hardware material for doors and windows. Perfect for handles, locks, hinges and other mechanical components.' :
                      selectedCategory === 'Accessories' ?
                      'This will create an accessory material for supporting items like seals, gaskets, and weather strips.' :
                      'This will create a consumable material for items that are used up during installation or maintenance.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create {selectedCategory} Material
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};

export default HardwareGlassCreationForm; 