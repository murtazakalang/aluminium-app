'use client';

import React, { useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Label } from '@/components/ui/label';

const GstSettingsForm = () => {
  const { settings, updateSettings, loading } = useSettings();
  const [error, setError] = useState('');

  const handleGstToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (settings) {
      updateSettings({
        gst: {
          ...settings.gst,
          enabled: e.target.checked,
        },
      });
    }
  };

  const handleGstPercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = parseFloat(e.target.value);
    setError('');

    // Validate the input is a valid percentage
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      setError('GST percentage must be between 0 and 100');
      return;
    }

    if (settings) {
      updateSettings({
        gst: {
          ...settings.gst,
          percentage: percentage,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">GST Settings</h3>
        <p className="text-sm text-gray-500">
          Configure Goods and Services Tax (GST) settings for invoices and quotations.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="gstEnabled"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={settings?.gst.enabled || false}
            onChange={handleGstToggle}
            disabled={loading}
          />
          <Label htmlFor="gstEnabled">Enable GST</Label>
        </div>

        {settings?.gst.enabled && (
          <div>
            <Label htmlFor="gstPercentage" className="mb-2 block">
              GST Percentage (%)
            </Label>
            <input
              type="number"
              id="gstPercentage"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={settings?.gst.percentage || 0}
              onChange={handleGstPercentageChange}
              min="0"
              max="100"
              step="0.01"
              disabled={loading}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            <p className="mt-1 text-sm text-gray-500">
              This percentage will be applied to all quotations and invoices.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GstSettingsForm; 