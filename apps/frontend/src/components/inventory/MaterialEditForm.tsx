'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  Save, X, Plus, Trash2, AlertCircle, 
  Package, Weight, Info, ArrowLeft 
} from 'lucide-react';
import { BatchMaterial } from '@/lib/api/batchInventoryService';
import { inventoryApi } from '@/lib/api/inventoryService';
import { toast } from 'sonner';

interface MaterialEditFormProps {
  material: BatchMaterial;
  onSave: () => void;
  onCancel: () => void;
}

interface StandardLength {
  length: string;
  unit: string;
}

interface GaugeWeight {
  gauge: string;
  referenceWeight: string;
  unitLength: string;
}

interface MaterialFormData {
  name: string;
  supplier: string;
  brand: string;
  hsnCode: string;
  description: string;
  standardLengths: StandardLength[];
  referenceGaugeWeights: GaugeWeight[];
}

const MaterialEditForm: React.FC<MaterialEditFormProps> = ({ 
  material, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState<MaterialFormData>({
    name: material.name,
    supplier: material.supplier || '',
    brand: material.brand || '',
    hsnCode: material.hsnCode || '',
    description: material.description || '',
    standardLengths: material.standardLengths || [],
    referenceGaugeWeights: material.referenceGaugeWeights || []
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const addStandardLength = () => {
    setFormData(prev => ({
      ...prev,
      standardLengths: [
        ...prev.standardLengths,
        { length: '', unit: 'ft' }
      ]
    }));
  };

  const removeStandardLength = (index: number) => {
    setFormData(prev => ({
      ...prev,
      standardLengths: prev.standardLengths.filter((_, i) => i !== index)
    }));
  };

  const updateStandardLength = (index: number, field: keyof StandardLength, value: string) => {
    setFormData(prev => ({
      ...prev,
      standardLengths: prev.standardLengths.map((length, i) => 
        i === index ? { ...length, [field]: value } : length
      )
    }));
  };

  const addGaugeWeight = () => {
    setFormData(prev => ({
      ...prev,
      referenceGaugeWeights: [
        ...prev.referenceGaugeWeights,
        { gauge: '', referenceWeight: '', unitLength: 'ft' }
      ]
    }));
  };

  const removeGaugeWeight = (index: number) => {
    setFormData(prev => ({
      ...prev,
      referenceGaugeWeights: prev.referenceGaugeWeights.filter((_, i) => i !== index)
    }));
  };

  const updateGaugeWeight = (index: number, field: keyof GaugeWeight, value: string) => {
    setFormData(prev => ({
      ...prev,
      referenceGaugeWeights: prev.referenceGaugeWeights.map((gauge, i) => 
        i === index ? { ...gauge, [field]: value } : gauge
      )
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Material name is required';
    }

    // Validate standard lengths for Profile materials
    if (material.category === 'Profile') {
      formData.standardLengths.forEach((length, index) => {
        if (!length.length.trim()) {
          newErrors[`standardLength_${index}`] = 'Length value is required';
        } else if (isNaN(parseFloat(length.length))) {
          newErrors[`standardLength_${index}`] = 'Length must be a valid number';
        }
      });

      // Validate gauge weights
      formData.referenceGaugeWeights.forEach((gauge, index) => {
        if (!gauge.gauge.trim()) {
          newErrors[`gauge_${index}`] = 'Gauge is required';
        }
        if (!gauge.referenceWeight.trim()) {
          newErrors[`gaugeWeight_${index}`] = 'Weight is required';
        } else if (isNaN(parseFloat(gauge.referenceWeight))) {
          newErrors[`gaugeWeight_${index}`] = 'Weight must be a valid number';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setLoading(true);
    
    try {
      // Prepare the update data for MaterialV2 system
      const updateData: any = {
        name: formData.name,
        supplier: formData.supplier,
        brand: formData.brand,
        hsnCode: formData.hsnCode,
        description: formData.description
      };

      // Add Profile-specific fields if this is a Profile material
      if (material.category === 'Profile') {
        updateData.standardLengths = formData.standardLengths.map(sl => ({
          length: parseFloat(sl.length),
          unit: sl.unit
        }));
        
        updateData.referenceGaugeWeights = formData.referenceGaugeWeights.map(gw => ({
          gauge: gw.gauge,
          referenceWeight: parseFloat(gw.referenceWeight),
          unitLength: gw.unitLength
        }));
      }

      await inventoryApi.updateMaterial(material.id, updateData);
      toast.success('Material updated successfully');
      onSave();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update material');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Material</h1>
            <p className="text-gray-600">
              {material.category} • Currently {parseFloat(material.aggregatedTotals.totalCurrentStock)} {material.stockUnit} in stock
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Badge className="bg-blue-100 text-blue-800">
            {material.category}
          </Badge>
          {material.category === 'Profile' && (
            <Badge className="bg-green-100 text-green-800">
              Editable Lengths & Gauges
            </Badge>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Basic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              id="name"
              name="name"
              label="Material Name"
              value={formData.name}
              onChange={handleInputChange}
              error={errors.name}
              required
            />
            
            <FormInput
              id="supplier"
              name="supplier"
              label="Default Supplier"
              value={formData.supplier}
              onChange={handleInputChange}
              placeholder="Supplier name"
            />
            
            <FormInput
              id="brand"
              name="brand"
              label="Brand"
              value={formData.brand}
              onChange={handleInputChange}
              placeholder="Brand name"
            />
            
            <FormInput
              id="hsnCode"
              name="hsnCode"
              label="HSN Code"
              value={formData.hsnCode}
              onChange={handleInputChange}
              placeholder="HSN code"
            />
          </div>
          
          <div className="mt-4">
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description"
            />
          </div>
        </Card>

        {/* Profile-specific sections */}
        {material.category === 'Profile' && (
          <>
            {/* Standard Lengths */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-semibold">Standard Lengths</h2>
                </div>
                <Button
                  type="button"
                  onClick={addStandardLength}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Length
                </Button>
              </div>
              
              {formData.standardLengths.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No standard lengths defined yet.</p>
                  <p className="text-sm">Click "Add Length" to add available lengths for this profile.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.standardLengths.map((length, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-md">
                      <div className="flex-1">
                        <FormInput
                          id={`length_${index}`}
                          name={`length_${index}`}
                          label="Length"
                          value={length.length}
                          onChange={(e) => updateStandardLength(index, 'length', e.target.value)}
                          error={errors[`standardLength_${index}`]}
                          placeholder="e.g., 10"
                          type="number"
                          step="0.01"
                        />
                      </div>
                      
                      <div className="w-24">
                        <label className="block text-sm font-medium mb-1">Unit</label>
                        <select
                          value={length.unit}
                          onChange={(e) => updateStandardLength(index, 'unit', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ft">ft</option>
                          <option value="m">m</option>
                          <option value="inches">inches</option>
                          <option value="mm">mm</option>
                        </select>
                      </div>
                      
                      <Button
                        type="button"
                        onClick={() => removeStandardLength(index)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Gauge Weights */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Weight className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-semibold">Gauge Reference Weights</h2>
                </div>
                <Button
                  type="button"
                  onClick={addGaugeWeight}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Gauge
                </Button>
              </div>
              
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Reference weights are used for estimation purposes only.</p>
                    <p>These help calculate material costs in quotations but don't affect actual stock tracking.</p>
                  </div>
                </div>
              </div>
              
              {formData.referenceGaugeWeights.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Weight className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No gauge weights defined yet.</p>
                  <p className="text-sm">Click "Add Gauge" to add weight references for different gauges.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.referenceGaugeWeights.map((gauge, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-md">
                      <div className="flex-1">
                        <FormInput
                          id={`gauge_${index}`}
                          name={`gauge_${index}`}
                          label="Gauge"
                          value={gauge.gauge}
                          onChange={(e) => updateGaugeWeight(index, 'gauge', e.target.value)}
                          error={errors[`gauge_${index}`]}
                          placeholder="e.g., 16G, 18G, 20G"
                        />
                      </div>
                      
                      <div className="flex-1">
                        <FormInput
                          id={`weight_${index}`}
                          name={`weight_${index}`}
                          label="Weight (kg per unit)"
                          value={gauge.referenceWeight}
                          onChange={(e) => updateGaugeWeight(index, 'referenceWeight', e.target.value)}
                          error={errors[`gaugeWeight_${index}`]}
                          placeholder="e.g., 0.5"
                          type="number"
                          step="0.001"
                        />
                      </div>
                      
                      <div className="w-24">
                        <label className="block text-sm font-medium mb-1">Per</label>
                        <select
                          value={gauge.unitLength}
                          onChange={(e) => updateGaugeWeight(index, 'unitLength', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ft">ft</option>
                          <option value="m">m</option>
                          <option value="inches">inches</option>
                          <option value="mm">mm</option>
                        </select>
                      </div>
                      
                      <Button
                        type="button"
                        onClick={() => removeGaugeWeight(index)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* Action Buttons */}
        <Card className="p-6">
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default MaterialEditForm; 