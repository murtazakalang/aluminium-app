'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StockAdjustmentForm from '@/components/inventory/StockAdjustmentForm';
import { Button } from '@/components/ui/Button';
import { inventoryApi, StockAdjustmentData, Material as ApiMaterial } from '@/lib/api/inventoryService';

// Helper function to convert API decimal values to strings
const decimalToString = (value: any): string => {
  if (value === null || typeof value === 'undefined') return '0'; // Default to '0' for consistency or handle as needed
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '$numberDecimal' in value) {
    return value.$numberDecimal;
  }
  return String(value); // Fallback, might be [object Object]
};

interface Material {
  _id: string;
  name: string;
  category: string;
  standardLengths: {
    length: string;
    unit: string;
  }[];
  stockUnit: string;
}

interface MaterialForForm {
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

export default function StockAdjustmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMaterialIdFromQuery = searchParams.get('materialId');
  
  const [materials, setMaterials] = useState<MaterialForForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setIsLoading(true);
        const fetchedMaterials: ApiMaterial[] = await inventoryApi.getMaterials();
        
        const formattedMaterials: MaterialForForm[] = fetchedMaterials.map(material => ({
          _id: material._id,
          name: material.name,
          category: material.category,
          stockUnit: material.stockUnit,
          standardLengths: (material.standardLengths || []).map(sl => ({
            length: decimalToString(sl.length),
            unit: sl.unit
          })),
          stockByLength: (material.stockByLength || []).map(sbl => ({
            length: decimalToString(sbl.length),
            unit: sbl.unit,
            quantity: decimalToString(sbl.quantity),
            lowStockThreshold: decimalToString(sbl.lowStockThreshold),
            unitRate: decimalToString(sbl.unitRate)
          })),
          totalStockQuantity: material.totalStockQuantity !== undefined ? decimalToString(material.totalStockQuantity) : undefined,
        }));
        
        setMaterials(formattedMaterials);
      } catch (err: any) {
        setError(err.message || 'Failed to load materials');
      } finally {
        setIsLoading(false);
      }
    };
    loadMaterials();
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      
      
      // Prepare API data
      const adjustmentData: StockAdjustmentData = {
        materialId: data.materialId,
        type: data.type,
        quantityChange: parseFloat(data.quantityChange),
        quantityUnit: data.quantityUnit || data.stockUnit,
        notes: data.notes || ''
      };
      
      // Add length details for profile materials if provided
      if (data.category === 'Profile' && data.length && data.lengthUnit) {
        adjustmentData.length = parseFloat(data.length);
        adjustmentData.lengthUnit = data.lengthUnit;
      }
      
      // Add unit rate if provided
      if (data.unitRate) {
        adjustmentData.unitRate = parseFloat(data.unitRate);
      }
      
      // Send adjustment to API
      const result = await inventoryApi.adjustStock(adjustmentData);
      
      // Set success message
      setSuccess('Stock adjustment processed successfully');
      
      // Redirect back to inventory page after a short delay
      setTimeout(() => {
        router.push('/dashboard/inventory');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'An error occurred while processing the adjustment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Adjustment</h1>
        <p className="text-gray-600 mt-1">
          Adjust stock levels for materials by adding or removing stock
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 p-4 rounded-md text-red-800 mb-6">
          <h2 className="text-lg font-medium">Error</h2>
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 p-4 rounded-md text-green-800 mb-6">
          <h2 className="text-lg font-medium">Success</h2>
          <p>{success}</p>
          <p className="mt-2">Redirecting to inventory page...</p>
        </div>
      )}
      
      {!success && (
        <StockAdjustmentForm
          materials={materials}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          initialMaterialId={initialMaterialIdFromQuery || ''}
          onSubmit={handleSubmit}
        />
      )}
      
      {!success && (
        <div className="mt-6 flex justify-start">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/inventory')}
            disabled={isSubmitting}
          >
            Back to Inventory
          </Button>
        </div>
      )}
    </div>
  );
} 