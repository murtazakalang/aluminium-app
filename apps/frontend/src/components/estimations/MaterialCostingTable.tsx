import React, { useState, useEffect } from 'react';
import { CalculatedMaterial, PipeBreakdownItem } from '@/lib/api/estimationService';

// Define the interface for individual breakdown items
// interface PipeBreakdownItem {
//   length: string | { $numberDecimal: string }; // Account for Decimal128
//   unit: string;
//   count: number;
// }

// Utility function to format the pipe breakdown
const formatPipeBreakdown = (totalPipes: string, breakdown?: PipeBreakdownItem[]): string => {
  if (!breakdown || breakdown.length === 0) {
    return `${parseFloat(totalPipes).toFixed(0)}`; // Fallback if no breakdown, whole number for pipes
  }

  const breakdownItems = breakdown.map(item => {
    const lengthValue = typeof item.length === 'object' && item.length.$numberDecimal 
      ? parseFloat(item.length.$numberDecimal).toFixed(2) 
      : parseFloat(item.length.toString()).toFixed(2);
    return `${item.count} × ${lengthValue}${item.unit}`;
  });

  // Format with parentheses around each size group: "4 (2 × 15.00ft)(2 × 12.00ft)"
  return `${parseFloat(totalPipes).toFixed(0)} (${breakdownItems.map(item => item).join(")(")})`;
};

// Utility function to format weight with unit
const formatWeight = (weight: string, unit: string): string => {
  if (!weight || parseFloat(weight) === 0) return '';
  
  return `Weight: ${parseFloat(weight).toFixed(2)}${unit}`;
};

interface MaterialCostingTableProps {
  materials: CalculatedMaterial[];
  onRateChange: (materialId: string, newRate: string) => void;
  readOnly?: boolean;
}

const MaterialCostingTable: React.FC<MaterialCostingTableProps> = ({ 
  materials, 
  onRateChange,
  readOnly = false
}) => {
  const [localMaterials, setLocalMaterials] = useState<CalculatedMaterial[]>(materials);
  
  useEffect(() => {
    setLocalMaterials(materials);
  }, [materials]);

  const handleRateChange = (materialId: string, value: string) => {
    // Update local state
    const updatedMaterials = localMaterials.map(material => 
      material.materialId === materialId 
        ? { ...material, manualUnitRate: value } 
        : material
    );
    setLocalMaterials(updatedMaterials);
    
    // Notify parent component
    onRateChange(materialId, value);
  };

  if (!materials || materials.length === 0) {
    return (
      <div className="bg-white p-4 rounded-md shadow">
        <p className="text-gray-500 italic">No materials have been calculated yet.</p>
      </div>
    );
  }

  // Group materials by sourceType
  const groupedMaterials = localMaterials.reduce((groups, material) => {
    const sourceType = material.sourceType || 'profile'; // Default to profile for backward compatibility
    if (!groups[sourceType]) {
      groups[sourceType] = [];
    }
    groups[sourceType].push(material);
    return groups;
  }, {} as Record<string, CalculatedMaterial[]>);

  // Define section titles and order
  const sectionConfig = {
    profile: { title: 'Profile Materials', icon: '🔧', color: 'blue' },
    hardware: { title: 'Hardware Materials', icon: '⚙️', color: 'green' },
    glass: { title: 'Glass Materials', icon: '🪟', color: 'purple' }
  };

  const renderMaterialSection = (sourceType: string, materials: CalculatedMaterial[]) => {
    const config = sectionConfig[sourceType as keyof typeof sectionConfig] || 
      { title: 'Other Materials', icon: '📦', color: 'gray' };
    
  return (
      <div key={sourceType} className="mb-6">
        <div className={`flex items-center space-x-2 px-4 py-2 bg-${config.color}-50 border-l-4 border-${config.color}-400 mb-4`}>
          <span className="text-lg">{config.icon}</span>
          <h3 className={`text-lg font-medium text-${config.color}-800`}>{config.title}</h3>
          <span className={`text-sm text-${config.color}-600`}>({materials.length} items)</span>
        </div>
        
        <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Material
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Quantity
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unit
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rate
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cost
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
              {materials.map((material) => (
            <tr key={material.materialId}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{material.materialNameSnapshot}</div>
                    {/* Show source items for glass materials */}
                    {sourceType === 'glass' && material.sourceItemIds && material.sourceItemIds.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Used in {material.sourceItemIds.length} item(s)
                      </div>
                    )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{material.materialCategorySnapshot}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">
                  {material.materialCategorySnapshot === 'Profile' && material.pipeBreakdown 
                    ? formatPipeBreakdown(material.totalQuantity, material.pipeBreakdown as PipeBreakdownItem[])
                    : parseFloat(material.totalQuantity).toFixed(2)}
                </div>
                {/* Display weight information for materials with weight */}
                {material.totalWeight && parseFloat(material.totalWeight) > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatWeight(material.totalWeight, material.weightUnit)}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">
                  {material.materialCategorySnapshot === 'Profile' && material.pipeBreakdown 
                        ? (material.quantityUnit === "pipes" ? "pipes" : material.quantityUnit)
                    : material.quantityUnit}
                </div>
              </td>
              <td className="px-6 py-4">
                {/* Auto rate display (read-only) */}
                {material.autoUnitRate && parseFloat(material.autoUnitRate) > 0 && (
                  <div className="text-xs text-gray-500 mb-1">
                    {parseFloat(material.autoUnitRate).toFixed(2)} / {material.autoRateUnit} (auto)
                  </div>
                )}
                {/* Manual rate input */}
                {readOnly ? (
                  <div className="text-sm text-gray-900">
                    {parseFloat(material.manualUnitRate || '0').toFixed(2)}
                  </div>
                ) : (
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={parseFloat(material.manualUnitRate || '0').toFixed(2)}
                      onChange={(e) => handleRateChange(material.materialId, e.target.value)}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
                      placeholder={`Manual rate override`}
                    />
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                      ₹{parseFloat(material.calculatedCost).toFixed(2)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-md shadow p-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Material Cost Breakdown</h2>
      
      {/* Render sections in order: profile, hardware, glass */}
      {Object.entries(groupedMaterials)
        .sort(([a], [b]) => {
          const order = ['profile', 'hardware', 'glass'];
          return order.indexOf(a) - order.indexOf(b);
        })
        .map(([sourceType, materials]) => renderMaterialSection(sourceType, materials))
      }
    </div>
  );
};

export default MaterialCostingTable; 