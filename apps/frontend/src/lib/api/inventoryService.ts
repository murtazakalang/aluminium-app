import { api } from '../api';

// Type definitions for inventory materials
export interface Material {
  _id: string;
  name: string;
  companyId: string;
  category: 'Profile' | 'Glass' | 'Hardware' | 'Accessories' | 'Consumables';
  stockUnit: string;
  usageUnit: 'ft' | 'inches' | 'mm' | 'sqft' | 'sqm' | 'pcs' | 'kg';
  unitRateForStockUnit: string | number;
  lowStockThresholdForStockUnit?: number;
  stockByLength?: Array<{
    length: string | number;
    unit: string;
    gauge?: string;
    quantity: string | number;
    lowStockThreshold?: number;
    unitRate?: string | number;
  }>;
  totalStockQuantity?: string | number;
  standardLengths?: Array<{
    length: string | number;
    unit: string;
  }>;
  gaugeSpecificWeights?: Array<{
    gauge: string;
    weightPerUnitLength: string | number;
    unitLength: string | number;
  }>;
  weightUnit?: string;
  supplier?: string;
  brand?: string;
  hsnCode?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Type for creating/updating material without required fields that are server-generated
export type MaterialFormData = Omit<Material, '_id' | 'companyId' | 'createdAt' | 'updatedAt'>;

// Profile Stock Inward Data
export interface ProfileStockInwardData {
  materialId: string;
  gauge: string;
  standardLength: {
    length: number | string;
    unit: string;
  };
  pieces: number | string;
  totalWeight: {
    weight: number | string;
    unit: string;
  };
  totalCost: number | string;
  supplier?: string;
  notes?: string;
  // Include these fields only if creating a new material
  name?: string;
  category?: 'Profile';
  stockUnit?: string;
  usageUnit?: 'ft' | 'inches' | 'mm';
  weightUnit?: 'kg' | 'lbs';
  brand?: string;
  hsnCode?: string;
  description?: string;
}

// Stock Adjustment Data
export interface StockAdjustmentData {
  materialId: string;
  type: 'Inward' | 'Outward-Manual' | 'Scrap' | 'Correction';
  quantityChange: number;
  quantityUnit: string;
  notes?: string;
  // For profiles with byLength adjustments
  length?: number;
  lengthUnit?: string;
  // For rate updates
  unitRate?: number;
}

// Transaction response
export interface StockTransactionResponse {
  _id: string;
  materialId: string;
  type: string;
  quantityChange: number;
  quantityUnit: string;
  totalValueChange: number;
  notes: string;
  createdAt: string;
}

// API functions for inventory management
export const inventoryApi = {
  // Get all materials from inventory
  getMaterials: () => 
    api<Material[]>('/api/inventory/materials'),

  // NEW: Get filtered glass category materials
  getGlassMaterials: async () => {
    const response = await api<{ 
      success: boolean; 
      count: number; 
      data: any[]; 
      v2Count: number; 
      oldCount: number; 
    }>('/api/v2/inventory/materials?category=Glass');
    
    // Transform the API response to match the Material interface, filtering for Glass materials
    const glassMaterials: Material[] = (response.data || [])
      .filter(item => item.category === 'Glass')
      .map(item => {
        // Determine the source of gauge information
        let gaugeData = item.referenceGaugeWeights; // Prefer referenceGaugeWeights from V2 system
        if (!gaugeData && item.gaugeSpecificWeights) {
          gaugeData = item.gaugeSpecificWeights; // Fallback to gaugeSpecificWeights for V1 or other structures
        }

        return {
          _id: item.id, // API returns 'id', but we need '_id'
          name: item.name,
          companyId: '', // Not needed for estimation form
          category: item.category,
          stockUnit: item.stockUnit,
          usageUnit: item.usageUnit,
          unitRateForStockUnit: item.aggregatedTotals?.averageRatePerPiece || '0',
          supplier: item.supplier || '',
          brand: item.brand || '',
          isActive: true, // API only returns active materials
          // Optional fields that might not exist
          lowStockThresholdForStockUnit: undefined,
          stockByLength: undefined,
          totalStockQuantity: item.aggregatedTotals?.totalCurrentStock,
          standardLengths: item.standardLengths || undefined,
          gaugeSpecificWeights: gaugeData ? gaugeData.map((g: any) => ({
            gauge: g.gauge,
            // Use referenceWeight if available (V2), else weightPerUnitLength (V1)
            weightPerUnitLength: g.referenceWeight !== undefined ? g.referenceWeight : g.weightPerUnitLength, 
            unitLength: g.unitLength
          })) : undefined,
          weightUnit: item.weightUnit || undefined,
          hsnCode: item.hsnCode || undefined,
          description: item.description || undefined,
          createdAt: undefined,
          updatedAt: undefined
        };
      });
    
    return glassMaterials;
  },

  // Get a single material by ID
  getMaterialById: (materialId: string) => 
    api<Material>(`/api/inventory/materials/${materialId}`),
    
  // Create a new material
  createMaterial: (materialData: MaterialFormData) => 
    api<Material>('/api/inventory/materials', { 
      method: 'POST', 
      body: materialData 
    }),
    
  // Update an existing material
  updateMaterial: (materialId: string, materialData: MaterialFormData) => 
    api<Material>(`/api/inventory/materials/${materialId}`, { 
      method: 'PUT', 
      body: materialData 
    }),
    
  // Delete a material
  deleteMaterial: (materialId: string) => 
    api<{ message: string; deletedMaterialId: string }>(`/api/inventory/materials/${materialId}`, { 
      method: 'DELETE' 
    }),
    
  // Record profile stock inward
  recordProfileStockInward: (data: ProfileStockInwardData) => 
    api<{ material: Material; stockTransaction: StockTransactionResponse }>('/api/inventory/stock/inward-profile', { 
      method: 'POST', 
      body: data 
    }),
    
  // Adjust stock (add, remove, or correct)
  adjustStock: (data: StockAdjustmentData) => 
    api<{ material: Material; stockTransaction: StockTransactionResponse }>('/api/inventory/stock/adjust', { 
      method: 'POST', 
      body: data 
    }),
    
  // Get stock transaction history for a material
  getStockHistory: (materialId: string) => 
    api<StockTransactionResponse[]>(`/api/inventory/stock/history/${materialId}`),

  // NEW: Get materials from both old and new systems (for product creation)
  getAllMaterialsForProducts: async () => {
    const response = await api<{ 
      success: boolean; 
      count: number; 
      data: any[]; // Using any[] because the API returns different format
      v2Count: number; 
      oldCount: number; 
    }>('/api/v2/inventory/materials');
    
    // Transform the API response to match the Material interface
    const materials: Material[] = (response.data || []).map(item => {
      // Determine the source of gauge information
      let gaugeData = item.referenceGaugeWeights; // Prefer referenceGaugeWeights from V2 system
      if (!gaugeData && item.gaugeSpecificWeights) {
        gaugeData = item.gaugeSpecificWeights; // Fallback to gaugeSpecificWeights for V1 or other structures
      }

      return {
        _id: item.id, // API returns 'id', but we need '_id'
        name: item.name,
        companyId: '', // Not needed for product form
        category: item.category,
        stockUnit: item.stockUnit,
        usageUnit: item.usageUnit,
        unitRateForStockUnit: item.aggregatedTotals?.averageRatePerPiece || '0',
        supplier: item.supplier || '',
        brand: item.brand || '',
        isActive: true, // API only returns active materials
        // Optional fields that might not exist
        lowStockThresholdForStockUnit: undefined,
        stockByLength: undefined,
        totalStockQuantity: item.aggregatedTotals?.totalCurrentStock,
        standardLengths: item.standardLengths || undefined, // Ensure standardLengths are passed if available
        gaugeSpecificWeights: gaugeData ? gaugeData.map((g: any) => ({ // Map the determined gauge data
          gauge: g.gauge,
          // Use referenceWeight if available (V2), else weightPerUnitLength (V1)
          weightPerUnitLength: g.referenceWeight !== undefined ? g.referenceWeight : g.weightPerUnitLength, 
          unitLength: g.unitLength
        })) : undefined,
        weightUnit: item.weightUnit || undefined,
        hsnCode: item.hsnCode || undefined,
        description: item.description || undefined,
        createdAt: undefined,
        updatedAt: undefined
      };
    });
    
    return materials;
  },
}; 