import React, { createContext, useContext, ReactNode } from 'react';
import { useSettings } from './SettingsContext';

interface UnitContextValue {
  // Current unit settings from General Settings
  dimensionUnit: 'inches' | 'mm';
  areaUnit: 'sqft' | 'sqm';
  
  // Derived helper functions
  getDefaultUsageUnit: (category: string) => string;
  getDefaultFormulaInputUnit: () => 'inches' | 'mm';
  getDefaultAreaUnit: () => 'sqft' | 'sqm';
  getDefaultDimensionUnit: () => 'inches' | 'mm';
  
  // Unit conversion helpers
  isUnitLoading: boolean;
  
  // Validation helpers
  isValidUsageUnitForCategory: (unit: string, category: string) => boolean;
}

const UnitContext = createContext<UnitContextValue | undefined>(undefined);

interface UnitProviderProps {
  children: ReactNode;
}

export function UnitProvider({ children }: UnitProviderProps) {
  const { settings, loading } = useSettings();
  
  // Get current unit preferences from settings with fallback defaults
  const dimensionUnit = settings?.units?.dimension || 'inches';
  const areaUnit = settings?.units?.area || 'sqft';
  
  // Helper function to get default usage unit based on category and current settings
  const getDefaultUsageUnit = (category: string): string => {
    switch (category) {
      case 'Profile':
        // Profile usage unit should match the current dimension setting
        return dimensionUnit === 'inches' ? 'inches' : 'mm';
      case 'Glass':
      case 'Wire Mesh':
        // Glass and Wire Mesh usage units should match the current area setting  
        return areaUnit;
      case 'Hardware':
      case 'Accessories':
      case 'Consumables':
        return 'pcs';
      default:
        return 'pcs';
    }
  };
  
  // Helper to get default formula input unit (always matches dimension setting)
  const getDefaultFormulaInputUnit = (): 'inches' | 'mm' => {
    return dimensionUnit;
  };
  
  // Helper to get default area unit
  const getDefaultAreaUnit = (): 'sqft' | 'sqm' => {
    return areaUnit;
  };
  
  // Helper to get default dimension unit
  const getDefaultDimensionUnit = (): 'inches' | 'mm' => {
    return dimensionUnit;
  };
  
  // Validation helper to check if a usage unit is valid for a category
  const isValidUsageUnitForCategory = (unit: string, category: string): boolean => {
    switch (category) {
      case 'Profile':
        return ['ft', 'inches', 'mm', 'm'].includes(unit);
      case 'Glass':
      case 'Wire Mesh':
        return ['sqft', 'sqm'].includes(unit);
      case 'Hardware':
      case 'Accessories':
      case 'Consumables':
        return ['pcs'].includes(unit);
      default:
        return true;
    }
  };
  
  const value: UnitContextValue = {
    dimensionUnit,
    areaUnit,
    getDefaultUsageUnit,
    getDefaultFormulaInputUnit,
    getDefaultAreaUnit,
    getDefaultDimensionUnit,
    isUnitLoading: loading,
    isValidUsageUnitForCategory,
  };
  
  return (
    <UnitContext.Provider value={value}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnits(): UnitContextValue {
  const context = useContext(UnitContext);
  if (context === undefined) {
    throw new Error('useUnits must be used within a UnitProvider');
  }
  return context;
}

// Helper hook for commonly needed unit info
export function useDefaultUnits() {
  const { dimensionUnit, areaUnit, getDefaultUsageUnit, getDefaultFormulaInputUnit } = useUnits();
  
  return {
    dimensionUnit,
    areaUnit,
    profileUsageUnit: getDefaultUsageUnit('Profile'),
    glassUsageUnit: getDefaultUsageUnit('Glass'),
    formulaInputUnit: getDefaultFormulaInputUnit(),
  };
} 