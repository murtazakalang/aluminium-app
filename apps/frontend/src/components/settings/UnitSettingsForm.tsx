'use client';

import React from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Label } from '@/components/ui/label';

const UnitSettingsForm = () => {
  const { settings, updateSettings, loading } = useSettings();

  const handleDimensionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (settings) {
      updateSettings({
        units: {
          ...settings.units,
          dimension: e.target.value as 'inches' | 'mm',
        },
      });
    }
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (settings) {
      updateSettings({
        units: {
          ...settings.units,
          area: e.target.value as 'sqft' | 'sqm',
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Unit Settings</h3>
        <p className="text-sm text-gray-500">
          Configure the default units used throughout the application.
        </p>
      </div>

      <div className="grid gap-4">
        <div>
          <Label htmlFor="dimensionUnit" className="mb-2 block">
            Dimension Unit
          </Label>
          <select
            id="dimensionUnit"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={settings?.units.dimension || 'inches'}
            onChange={handleDimensionChange}
            disabled={loading}
          >
            <option value="inches">Inches</option>
            <option value="mm">Millimeters (mm)</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Used for window dimensions (width, height)
          </p>
        </div>

        <div>
          <Label htmlFor="areaUnit" className="mb-2 block">
            Area Unit
          </Label>
          <select
            id="areaUnit"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={settings?.units.area || 'sqft'}
            onChange={handleAreaChange}
            disabled={loading}
          >
            <option value="sqft">Square Feet (sqft)</option>
            <option value="sqm">Square Meters (sqm)</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Used for area calculations and pricing
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnitSettingsForm; 