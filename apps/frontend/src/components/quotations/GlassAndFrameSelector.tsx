import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/Input';
import { inventoryApi, Material } from '@/lib/api/inventoryService';

interface GlassAndFrameSelectorProps {
  selectedGlassTypeId?: string;
  selectedGlassTypeName?: string;
  frameColour?: string;
  onGlassTypeChange: (glassTypeId: string, glassTypeName: string) => void;
  onFrameColourChange: (colour: string) => void;
  displayOnly?: boolean;
  disabled?: boolean;
}

const GlassAndFrameSelector: React.FC<GlassAndFrameSelectorProps> = ({
  selectedGlassTypeId,
  selectedGlassTypeName,
  frameColour,
  onGlassTypeChange,
  onFrameColourChange,
  displayOnly = true,
  disabled = false
}) => {
  const [glassMaterials, setGlassMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Predefined frame colours
  const frameColours = [
    'White',
    'Brown',
    'Black',
    'Silver',
    'Grey',
    'Bronze',
    'Golden',
    'Wooden',
    'Natural'
  ];

  // Fetch glass materials on component mount
  useEffect(() => {
    const fetchGlassMaterials = async () => {
      try {
        setLoading(true);
        setError(null);
        const materials = await inventoryApi.getGlassMaterials();
        setGlassMaterials(materials); // Backend already filters for isActive: true
      } catch (err: any) {
        setError(err.message || 'Failed to load glass materials');
        setGlassMaterials([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGlassMaterials();
  }, []);

  const handleGlassTypeSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const glassTypeId = e.target.value;
    if (!glassTypeId) {
      onGlassTypeChange('', '');
      return;
    }

    const selectedGlass = glassMaterials.find(material => material._id === glassTypeId);
    if (selectedGlass) {
      onGlassTypeChange(glassTypeId, selectedGlass.name);
    }
  };

  const handleFrameColourChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onFrameColourChange(e.target.value);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Glass Type</Label>
          <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-500">
            Loading glass types...
          </div>
        </div>
        <div className="space-y-2">
          <Label>Frame Colour</Label>
          <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-500">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Glass Type</Label>
          <div className="flex h-10 w-full rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Frame Colour</Label>
          <Input
            value={frameColour || ''}
            onChange={handleFrameColourChange}
            placeholder="Enter frame colour"
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayOnly && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start space-x-2">
            <div className="text-blue-600 text-sm">ℹ️</div>
            <div className="text-sm text-blue-700">
              <strong>Display Information Only</strong>
              <p className="mt-1 text-blue-600">
                Glass type and frame colour are for specification display only. 
                They do not affect the quotation price.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="glassType">
            Glass Type 
            {selectedGlassTypeName && (
              <span className="text-sm text-gray-500"> (from estimation)</span>
            )}
          </Label>
          <select
            id="glassType"
            value={selectedGlassTypeId || ''}
            onChange={handleGlassTypeSelection}
            disabled={disabled || glassMaterials.length === 0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select glass type...</option>
            {glassMaterials.map((material) => (
              <option key={material._id} value={material._id}>
                {material.name}
              </option>
            ))}
          </select>
          
          {selectedGlassTypeName && (
            <p className="text-sm text-gray-600">
              Pre-selected: {selectedGlassTypeName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="frameColour">Frame Colour</Label>
          <div className="flex space-x-2">
            <select
              id="frameColourSelect"
              value={frameColours.includes(frameColour || '') ? frameColour : ''}
              onChange={handleFrameColourChange}
              disabled={disabled}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select colour...</option>
              {frameColours.map((colour) => (
                <option key={colour} value={colour}>
                  {colour}
                </option>
              ))}
              <option value="Custom">Custom</option>
            </select>
          </div>
          
          {/* Custom colour input */}
          {(!frameColours.includes(frameColour || '') && frameColour) && (
            <Input
              placeholder="Enter custom frame colour"
              value={frameColour || ''}
              onChange={handleFrameColourChange}
              disabled={disabled}
              className="mt-2"
            />
          )}
        </div>
      </div>

      {glassMaterials.length === 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            No glass materials available. Please add glass materials to inventory first.
          </p>
        </div>
      )}

      {/* Display selected values summary */}
      {(selectedGlassTypeId || frameColour) && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Selected Specifications:</h4>
          <div className="text-sm text-gray-600 space-y-1">
            {selectedGlassTypeId && (
              <div>
                <span className="font-medium">Glass: </span>
                {glassMaterials.find(m => m._id === selectedGlassTypeId)?.name || selectedGlassTypeName || 'Unknown'}
              </div>
            )}
            {frameColour && (
              <div>
                <span className="font-medium">Frame: </span>
                {frameColour}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlassAndFrameSelector; 