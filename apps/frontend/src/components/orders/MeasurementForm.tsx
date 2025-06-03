import React, { useState } from 'react';
import { Order, MeasurementConfirmationData } from '@/lib/api/orderService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface MeasurementFormProps {
  order: Order;
  onSubmit: (data: MeasurementConfirmationData) => void;
  isSubmitting: boolean;
}

interface ItemMeasurement {
  itemId: string;
  finalWidth: number;
  finalHeight: number;
  finalQuantity: number;
}

export const MeasurementForm: React.FC<MeasurementFormProps> = ({
  order,
  onSubmit,
  isSubmitting,
}) => {
  const [measurements, setMeasurements] = useState<ItemMeasurement[]>(
    order.items.map(item => ({
      itemId: item._id || '',
      finalWidth: item.finalWidth,
      finalHeight: item.finalHeight,
      finalQuantity: item.finalQuantity,
    }))
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateMeasurements = (): boolean => {
    const newErrors: Record<string, string> = {};

    measurements.forEach((measurement, index) => {
      if (measurement.finalWidth <= 0) {
        newErrors[`width-${index}`] = 'Width must be greater than 0';
      }
      if (measurement.finalHeight <= 0) {
        newErrors[`height-${index}`] = 'Height must be greater than 0';
      }
      if (measurement.finalQuantity <= 0) {
        newErrors[`quantity-${index}`] = 'Quantity must be greater than 0';
      }
      if (!Number.isInteger(measurement.finalQuantity)) {
        newErrors[`quantity-${index}`] = 'Quantity must be a whole number';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateMeasurements()) {
      return;
    }

    onSubmit({ items: measurements });
  };

  const updateMeasurement = (index: number, field: keyof ItemMeasurement, value: number) => {
    setMeasurements(prev => 
      prev.map((measurement, i) => 
        i === index 
          ? { ...measurement, [field]: value }
          : measurement
      )
    );
    
    // Clear error for this field
    const errorKey = `${field.replace('final', '').toLowerCase()}-${index}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const formatDimension = (value: number, unit: string) => {
    return `${value} ${unit}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Confirm Final Measurements
        </h2>
        <p className="text-sm text-gray-600">
          Please review and update the final dimensions and quantities for each item.
          These measurements will be used for production planning and material calculations.
        </p>
      </div>

      <div className="space-y-4">
        {order.items.map((item, index) => {
          const measurement = measurements[index];
          return (
            <Card key={item._id || index} className="p-4">
              <div className="mb-4">
                <h3 className="font-medium text-gray-900">
                  {item.productTypeNameSnapshot || 'Unknown Product'}
                </h3>
                {item.itemLabel && (
                  <p className="text-sm text-gray-600">Label: {item.itemLabel}</p>
                )}
                <div className="text-sm text-gray-500 mt-1">
                  Original: {formatDimension(item.originalWidth || item.finalWidth, order.dimensionUnit)} × {formatDimension(item.originalHeight || item.finalHeight, order.dimensionUnit)} × {item.originalQuantity || item.finalQuantity} pcs
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Final Width ({order.dimensionUnit})
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={measurement.finalWidth}
                    onChange={(e) => updateMeasurement(index, 'finalWidth', parseFloat(e.target.value) || 0)}
                    className={errors[`width-${index}`] ? 'border-red-500' : ''}
                    required
                  />
                  {errors[`width-${index}`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`width-${index}`]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Final Height ({order.dimensionUnit})
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={measurement.finalHeight}
                    onChange={(e) => updateMeasurement(index, 'finalHeight', parseFloat(e.target.value) || 0)}
                    className={errors[`height-${index}`] ? 'border-red-500' : ''}
                    required
                  />
                  {errors[`height-${index}`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`height-${index}`]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Final Quantity (pcs)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={measurement.finalQuantity}
                    onChange={(e) => updateMeasurement(index, 'finalQuantity', parseInt(e.target.value) || 0)}
                    className={errors[`quantity-${index}`] ? 'border-red-500' : ''}
                    required
                  />
                  {errors[`quantity-${index}`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`quantity-${index}`]}</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Confirming...' : 'Confirm Measurements'}
        </Button>
      </div>
    </form>
  );
}; 