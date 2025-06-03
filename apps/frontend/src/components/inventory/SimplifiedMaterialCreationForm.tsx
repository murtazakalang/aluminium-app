'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormInput } from '@/components/ui/FormInput';
import { Badge } from '@/components/ui/Badge';
import { Loader2, Plus, Trash2, AlertCircle, Package, ArrowLeft } from 'lucide-react';
import { batchInventoryApi, SimplifiedMaterialData } from '@/lib/api/batchInventoryService';
import { toast } from 'sonner';
import { useUnits } from '@/contexts/UnitContext';

interface SimplifiedMaterialCreationFormProps {
  isOpen?: boolean; // Keep for compatibility but unused
  onClose: () => void;
  onSuccess: (material: any) => void;
}

const SimplifiedMaterialCreationForm: React.FC<SimplifiedMaterialCreationFormProps> = ({
  onClose,
  onSuccess
}) => {
  const { getDefaultUsageUnit, dimensionUnit } = useUnits();
  const profileUsageUnit = getDefaultUsageUnit('Profile');
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<SimplifiedMaterialData>>({
    name: '',
    category: 'Profile',
    stockUnit: 'pcs',
    usageUnit: profileUsageUnit,
    standardLengths: [{ length: 10, unit: 'ft' }],
    gauges: [{ gauge: '18' }],
    standardWidths: [],
    supplier: '',
    brand: '',
    hsnCode: '',
    description: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addStandardLength = () => {
    setFormData(prev => ({
      ...prev,
      standardLengths: [
        ...(prev.standardLengths || []),
        { length: 12, unit: 'ft' }
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

  const addGauge = () => {
    setFormData(prev => ({
      ...prev,
      gauges: [
        ...(prev.gauges || []),
        { gauge: '18' }
      ]
    }));
  };

  const removeGauge = (index: number) => {
    setFormData(prev => ({
      ...prev,
      gauges: prev.gauges?.filter((_, i) => i !== index) || []
    }));
  };

  const updateGauge = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      gauges: prev.gauges?.map((item, i) => 
        i === index ? { gauge: value } : item
      ) || []
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name?.trim()) return 'Material name is required';
    
    // Profile materials always require standard lengths and gauges
    if (!formData.standardLengths || formData.standardLengths.length === 0) {
      return 'At least one standard length is required for Profile materials';
    }
    if (!formData.gauges || formData.gauges.length === 0) {
      return 'At least one gauge is required for Profile materials';
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

    setIsLoading(true);
    
    try {
      const materialData: SimplifiedMaterialData = {
        name: formData.name!.trim(),
        category: 'Profile',
        stockUnit: 'pcs',
        usageUnit: profileUsageUnit,
        standardLengths: formData.standardLengths || [],
        gauges: formData.gauges || [],
        standardWidths: [], // Not used for Profile materials
        supplier: formData.supplier?.trim() || undefined,
        brand: formData.brand?.trim() || undefined,
        hsnCode: formData.hsnCode?.trim() || undefined,
        description: formData.description?.trim() || undefined
      };

      const response = await batchInventoryApi.createSimplifiedMaterial(materialData);
      
      toast.success(`Profile material "${formData.name}" created successfully!`);
      onSuccess(response.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create material');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">Create Profile Material</h2>
              <p className="text-sm text-gray-600">Create materials with predefined lengths and gauges for streamlined stock management</p>
            </div>
            <Badge className="bg-blue-100 text-blue-800">Profile Setup</Badge>
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Basic Information</h3>
            <div className="max-w-md">
              <FormInput
                id="name"
                name="name"
                label="Material Name *"
                value={formData.name || ''}
                onChange={handleInputChange}
                placeholder="e.g., 3Track Top, 6Track Bottom, Corner"
                required
              />
            </div>
          </div>

          {/* Supplier Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Supplier Information</h3>
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
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description"
            />
          </div>

          {/* Profile Materials: Standard Lengths */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">
                Standard Lengths *
              </h3>
              <Button
                type="button"
                onClick={addStandardLength}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Length
              </Button>
            </div>
            
            <div className="space-y-2">
              {formData.standardLengths?.map((length, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="number"
                    value={length.length}
                    onChange={(e) => updateStandardLength(index, 'length', parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Length"
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
          </div>

          {/* Profile Materials: Gauges */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">
                Standard Gauges *
              </h3>
              <Button
                type="button"
                onClick={addGauge}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Gauge
              </Button>
            </div>
            
            <div className="space-y-2">
              {formData.gauges?.map((gauge, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={gauge.gauge}
                    onChange={(e) => updateGauge(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 18, 20, 1.5mm"
                  />
                  <Button
                    type="button"
                    onClick={() => removeGauge(index)}
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Info Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Profile Material Setup</p>
                <p>
                  This will create a Profile material with predefined configurations for faster stock entry. 
                  Standard lengths and gauges are required for proper batch tracking.
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
              Create Material
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SimplifiedMaterialCreationForm; 