'use client';

import React, { useState, useEffect } from 'react';
import { ChargeType } from '@/contexts/SettingsContext';
import { Label } from '@/components/ui/label';

interface ChargeFormProps {
  charge?: ChargeType;
  onSubmit: (charge: Omit<ChargeType, '_id'> & { _id?: string }) => void;
  onCancel: () => void;
}

const ChargeForm: React.FC<ChargeFormProps> = ({
  charge,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState('');

  // Initialize form with charge data if editing
  useEffect(() => {
    if (charge) {
      setName(charge.name);
      setIsDefault(charge.isDefault);
    }
  }, [charge]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate name
    if (!name.trim()) {
      setError('Charge name is required');
      return;
    }

    // Submit the charge
    onSubmit({
      _id: charge?._id,
      name: name.trim(),
      isDefault,
    });
  };

  return (
    <div className="bg-white p-6 rounded-md shadow-sm">
      <h3 className="text-lg font-medium mb-4">
        {charge ? 'Edit Charge' : 'Add New Charge'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="chargeName" className="mb-2 block">
            Charge Name
          </Label>
          <input
            id="chargeName"
            type="text"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Freight, Loading, Installation"
          />
          {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isDefault"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <Label htmlFor="isDefault">
            Default Charge (automatically included in quotations)
          </Label>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            {charge ? 'Update' : 'Add'} Charge
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChargeForm; 