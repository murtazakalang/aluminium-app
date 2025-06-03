import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { FiInfo } from 'react-icons/fi';

interface Material {
  _id: string;
  name: string;
  category: string;
  standardLengths: {
    length: string;
    unit: string;
  }[];
  stockUnit: string;
  stockByLength?: {
    length: string;
    unit: string;
    quantity: string;
    lowStockThreshold: string;
    unitRate: string;
  }[];
  totalStockQuantity?: string;
}

interface StockAdjustmentFormProps {
  materials: Material[];
  isLoading: boolean;
  isSubmitting: boolean;
  initialMaterialId?: string;
  onSubmit: (data: StockAdjustmentData) => void;
}

interface StockAdjustmentData {
  materialId: string;
  length?: string;
  lengthUnit?: string;
  quantityChange: string;
  quantityUnit: string;
  type: 'Inward' | 'Outward-Manual' | 'Scrap' | 'Correction';
  notes: string;
}

// Type for the data payload submitted by the form
interface SubmitPayload extends StockAdjustmentData {
  category?: string; // Add category here
}

export default function StockAdjustmentForm({
  materials,
  isLoading,
  isSubmitting,
  initialMaterialId,
  onSubmit,
}: StockAdjustmentFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  const [adjustmentMode, setAdjustmentMode] = useState<'byLength' | 'bulk'>('byLength');
  
  const [formData, setFormData] = useState<StockAdjustmentData>({
    materialId: initialMaterialId || '',
    length: '',
    lengthUnit: 'ft',
    quantityChange: '1',
    quantityUnit: 'pcs',
    type: 'Inward',
    notes: '',
  });

  useEffect(() => {
    if (materials.length > 0 && formData.materialId) {
      const material = materials.find((m) => m._id === formData.materialId);
      if (material) {
        setSelectedMaterial(material);
        
        if (material.category === 'Profile') {
          setFormData((prev) => ({
            ...prev,
            quantityUnit: adjustmentMode === 'byLength' ? 'pcs' : (material.stockUnit || 'kg')
          }));
          
          if (material.standardLengths?.length === 1 && adjustmentMode === 'byLength') {
            setFormData((prev) => ({
              ...prev,
              length: material.standardLengths[0].length,
              lengthUnit: material.standardLengths[0].unit,
            }));
          }
        } else {
          setFormData((prev) => ({
            ...prev,
            quantityUnit: material.stockUnit || 'pcs',
            length: undefined,
            lengthUnit: undefined
          }));
        }
      }
    }
  }, [materials, formData.materialId, adjustmentMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    if (name === 'materialId') {
      const material = materials.find((m) => m._id === value);
      setSelectedMaterial(material || null);
      
      if (material) {
        if (material.category === 'Profile') {
          setAdjustmentMode('byLength');
          setFormData((prev) => ({
            ...prev,
            length: '',
            lengthUnit: 'ft',
            quantityUnit: 'pcs'
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            quantityUnit: material.stockUnit || 'pcs',
            length: undefined,
            lengthUnit: undefined
          }));
        }
      }
    }
  };

  const handleAdjustmentModeChange = (mode: 'byLength' | 'bulk') => {
    setAdjustmentMode(mode);
    
    if (mode === 'byLength') {
      setFormData((prev) => ({
        ...prev,
        quantityUnit: 'pcs',
        length: '',
        lengthUnit: 'ft'
      }));
    } else {
      if (selectedMaterial) {
        setFormData((prev) => ({
          ...prev,
          quantityUnit: selectedMaterial.stockUnit || 'kg',
          length: undefined,
          lengthUnit: undefined
        }));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.materialId) {
      newErrors.materialId = 'Please select a material';
    }
    
    if (selectedMaterial?.category === 'Profile' && adjustmentMode === 'byLength' && !formData.length) {
      newErrors.length = 'Please select a length';
    }
    
    if (!formData.quantityChange.trim()) {
      newErrors.quantityChange = 'Quantity is required';
    } else if (isNaN(parseFloat(formData.quantityChange))) {
      newErrors.quantityChange = 'Quantity must be a number';
    } else if (parseFloat(formData.quantityChange) <= 0) {
      newErrors.quantityChange = 'Quantity must be greater than 0';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const submitData = Object.fromEntries(
      Object.entries(formData).filter(([_, v]) => v !== undefined)
    ) as StockAdjustmentData;
    
    onSubmit({...submitData, category: selectedMaterial?.category } as SubmitPayload );
  };

  const adjustmentTypes = [
    { value: 'Inward', label: 'Inward (Add Stock)' },
    { value: 'Outward-Manual', label: 'Outward (Remove Stock)' },
    { value: 'Scrap', label: 'Scrap' },
    { value: 'Correction', label: 'Correction' },
  ];

  if (isLoading) {
    return <div className="text-center py-8">Loading materials...</div>;
  }
  
  const getQuantityLabel = () => {
    if (selectedMaterial?.category === 'Profile' && adjustmentMode === 'byLength') {
      return 'Quantity (pieces)';
    } else if (selectedMaterial) {
      return `Quantity (${formData.quantityUnit})`;
    }
    return 'Quantity';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-blue-50 p-4 rounded-md mb-6">
        <p className="text-sm text-blue-800 flex items-start">
          <FiInfo className="mr-2 mt-0.5 flex-shrink-0" />
          Adjust stock levels for materials. 
          {selectedMaterial?.category === 'Profile' && 
            ' For profiles, you can adjust specific standard lengths or total bulk quantity.'}
          {selectedMaterial && selectedMaterial.category !== 'Profile' &&
            ` For ${selectedMaterial.category.toLowerCase()} materials, you can adjust total quantity in ${formData.quantityUnit}.`}
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="materialId" className="block text-sm font-medium text-gray-700">
            Material
          </label>
          <div className="mt-1">
            <select
              id="materialId"
              name="materialId"
              value={formData.materialId}
              onChange={handleInputChange}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.materialId ? 'border-red-500' : ''
              }`}
            >
              <option value="">Select a material</option>
              {materials.map((material) => (
                <option key={material._id} value={material._id}>
                  {material.name} ({material.category})
                </option>
              ))}
            </select>
            {errors.materialId && (
              <p className="mt-1 text-sm text-red-600">{errors.materialId}</p>
            )}
          </div>
        </div>
        
        {selectedMaterial?.category === 'Profile' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjustment Mode
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-blue-600"
                  name="adjustmentMode"
                  value="byLength"
                  checked={adjustmentMode === 'byLength'}
                  onChange={() => handleAdjustmentModeChange('byLength')}
                />
                <span className="ml-2">Adjust by Standard Length</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-blue-600"
                  name="adjustmentMode" 
                  value="bulk"
                  checked={adjustmentMode === 'bulk'}
                  onChange={() => handleAdjustmentModeChange('bulk')}
                />
                <span className="ml-2">Adjust Total Bulk Stock ({selectedMaterial.stockUnit})</span>
              </label>
            </div>
          </div>
        )}
        
        {selectedMaterial?.category === 'Profile' && adjustmentMode === 'byLength' && (
          <div>
            <label htmlFor="length" className="block text-sm font-medium text-gray-700">
              Standard Length
            </label>
            <div className="mt-1">
              <select
                id="length"
                name="length"
                value={formData.length}
                onChange={(e) => {
                  const selectedLength = selectedMaterial?.standardLengths.find(
                    (len) => len.length === e.target.value
                  );
                  setFormData((prev) => ({
                    ...prev,
                    length: e.target.value,
                    lengthUnit: selectedLength?.unit || prev.lengthUnit,
                  }));
                }}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  errors.length ? 'border-red-500' : ''
                }`}
              >
                <option value="">Select a length</option>
                {selectedMaterial?.standardLengths.map((length, index) => (
                  <option key={index} value={length.length}>
                    {length.length} {length.unit}
                  </option>
                ))}
              </select>
              {errors.length && (
                <p className="mt-1 text-sm text-red-600">{errors.length}</p>
              )}
            </div>
          </div>
        )}
        
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Adjustment Type
          </label>
          <div className="mt-1">
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {adjustmentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <FormInput
          label={getQuantityLabel()}
          id="quantityChange"
          name="quantityChange"
          type="number"
          min="0.01"
          step="0.01"
          value={formData.quantityChange}
          onChange={handleInputChange}
          error={errors.quantityChange}
          required
        />
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes (Optional)
          </label>
          <div className="mt-1">
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleInputChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Add any additional information about this adjustment"
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          onClick={() => router.back()}
          variant="outline"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !selectedMaterial}>
          {isSubmitting ? 'Submitting...' : 'Submit Adjustment'}
        </Button>
      </div>
    </form>
  );
} 