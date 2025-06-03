import { api } from '../api';

// ============================================================================
// TYPE DEFINITIONS FOR BATCH INVENTORY SYSTEM
// ============================================================================

export interface BatchMaterial {
  id: string;
  name: string;
  category: 'Profile' | 'Glass' | 'Hardware' | 'Accessories' | 'Consumables' | 'Wire Mesh';
  stockUnit: string;
  usageUnit: 'ft' | 'inches' | 'mm' | 'sqft' | 'sqm' | 'pcs' | 'kg';
  supplier?: string;
  brand?: string;
  hsnCode?: string;
  description?: string;
  aggregatedTotals: {
    totalCurrentStock: string;
    totalCurrentWeight: string;
    totalCurrentValue: string;
    averageRatePerPiece: string;
    averageRatePerKg: string;
    lastUpdated: string;
  };
  activeBatchCount: number;
  hasLowStock: boolean;
  systemType?: 'v2' | 'legacy'; // Indicates if material is from new batch system or legacy system
}

export interface StockBatch {
  batchId: string;
  
  // Profile materials fields
  length?: string;
  lengthUnit?: string;
  gauge?: string;
  actualTotalWeight?: string;
  actualWeightUnit?: string;
  ratePerPiece?: string;
  ratePerKg?: string;
  
  // Wire Mesh specific fields
  selectedWidth?: string;
  widthUnit?: string;
  rollLength?: string;
  rollLengthUnit?: string;
  areaPerRoll?: string;
  totalArea?: string;
  areaUnit?: string;
  ratePerArea?: string;
  
  // Non-Profile materials fields
  ratePerUnit?: string;
  
  // Common fields for all materials
  originalQuantity: string;
  currentQuantity: string;
  totalCostPaid: string;
  supplier?: string;
  purchaseDate: string;
  invoiceNumber?: string;
  lotNumber?: string;
  notes?: string;
  isActive: boolean;
  isCompleted: boolean;
  utilizationPercent: string;
}

export interface StockSummary {
  [key: string]: {
    length: string;
    lengthUnit: string;
    gauge?: string;
    totalQuantity: number;
    totalWeight: number;
    totalValue: number;
    averageRate: number;
    batches: Array<{
      batchId: string;
      quantity: number;
      rate: number;
      supplier?: string;
      purchaseDate: string;
      invoiceNumber?: string;
    }>;
  };
}

export interface MaterialStockReport {
  material: {
    id: string;
    name: string;
    category: string;
    stockUnit: string;
    usageUnit: string;
  };
  aggregatedTotals: {
    totalCurrentStock: string;
    totalCurrentWeight: string;
    totalCurrentValue: string;
    averageRatePerPiece: string;
    averageRatePerKg: string;
    lastUpdated: string;
  };
  stockSummary: StockSummary;
  activeBatches: StockBatch[];
  totalBatches: number;
  lastUpdated: string;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface BatchStockInwardData {
  // Existing material
  materialId?: string;
  
  // New material creation fields
  name?: string;
  category?: 'Profile' | 'Glass' | 'Hardware' | 'Accessories' | 'Consumables' | 'Wire Mesh';
  stockUnit?: string;
  usageUnit?: 'ft' | 'inches' | 'mm' | 'sqft' | 'sqm' | 'pcs' | 'kg';
  brand?: string;
  hsnCode?: string;
  description?: string;
  
  // Stock inward data
  length?: number; // Optional for non-Profile materials
  lengthUnit?: string; // Optional for non-Profile materials
  gauge?: string;
  quantity: number;
  actualWeight?: number;
  actualWeightUnit?: string;
  totalCost: number;
  supplier?: string;
  invoiceNumber?: string;
  lotNumber?: string;
  notes?: string;
}

export interface SimplifiedMaterialData {
  name: string;
  category: 'Profile' | 'Glass' | 'Hardware' | 'Accessories' | 'Consumables' | 'Wire Mesh';
  stockUnit: string;
  usageUnit: string;
  standardLengths: Array<{
    length: number;
    unit: string;
  }>;
  gauges: Array<{
    gauge: string;
  }>;
  standardWidths?: Array<{
    width: number;
    unit: string;
  }>; // For Wire Mesh materials
  supplier?: string;
  brand?: string;
  hsnCode?: string;
  description?: string;
  initialPricePerUnit?: number;
}

export interface StockConsumptionData {
  materialId: string;
  length?: number;
  lengthUnit?: string;
  gauge?: string;
  quantityNeeded: number;
  consumptionType?: 'Production' | 'Scrap' | 'Transfer' | 'QualityTest';
  sortOrder?: 'FIFO' | 'LIFO';
  notes?: string;
}

export interface BatchConsumptionResult {
  success: boolean;
  totalConsumed: number;
  consumedBatches: Array<{
    batchId: string;
    quantityConsumed: number;
    actualWeightConsumed?: number;
    ratePerPiece: number;
    supplier?: string;
    purchaseDate: string;
    invoiceNumber?: string;
  }>;
}

export interface BatchFilters {
  startDate?: string;
  endDate?: string;
  supplier?: string;
  gauge?: string;
  includeCompleted?: boolean;
}

export interface AvailableBatchFilters {
  length?: number;
  lengthUnit?: string;
  gauge?: string;
  sortOrder?: 'FIFO' | 'LIFO';
  minQuantity?: number;
}

export interface ConsumptionHistoryEntry {
  transactionId: string;
  transactionDate: string;
  type: 'Outward-OrderCut' | 'Outward-Manual';
  quantityConsumed: number;
  quantityUnit: string;
  length?: string;
  lengthUnit?: string;
  unitRate: string;
  totalValue: number;
  notes?: string;
  consumedBy?: {
    name: string;
    email: string;
  };
  orderDetails?: {
    orderId: string;
    orderIdDisplay: string;
    clientName: string;
    orderStatus: string;
  };
  cuttingPlanDetails?: {
    cuttingPlanId: string;
    status: string;
  };
}

export interface ConsumptionHistoryFilters {
  startDate?: string;
  endDate?: string;
  orderId?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// BATCH INVENTORY API SERVICE
// ============================================================================

export const batchInventoryApi = {
  // ========================================
  // Stock Inward Operations
  // ========================================
  
  /**
   * Record new stock inward as a batch
   */
  recordStockInward: (data: BatchStockInwardData) => 
    api<{
      success: boolean;
      message: string;
      data: {
        material: BatchMaterial;
        batch: StockBatch;
        batchId: string;
        isNewMaterial: boolean;
      };
    }>('/api/v2/inventory/stock-inward', { 
      method: 'POST', 
      body: data 
    }),

  // ========================================
  // Stock Consumption Operations
  // ========================================
  
  /**
   * Consume stock from batches using FIFO/LIFO
   */
  consumeStock: (data: StockConsumptionData) => 
    api<{
      success: boolean;
      message: string;
      data: BatchConsumptionResult;
    }>('/api/v2/inventory/consume-stock', { 
      method: 'POST', 
      body: data 
    }),

  // ========================================
  // Reporting & Analysis
  // ========================================
  
  /**
   * Get detailed stock report for a material
   */
  getStockReport: (materialId: string) => 
    api<{
      success: boolean;
      data: MaterialStockReport;
    }>(`/api/v2/inventory/stock-report/${materialId}`),

  /**
   * Get batch history for a material
   */
  getBatchHistory: (materialId: string, filters?: BatchFilters) => {
    const queryParams = new URLSearchParams();
    if (filters?.startDate) queryParams.set('startDate', filters.startDate);
    if (filters?.endDate) queryParams.set('endDate', filters.endDate);
    if (filters?.supplier) queryParams.set('supplier', filters.supplier);
    if (filters?.gauge) queryParams.set('gauge', filters.gauge);
    if (filters?.includeCompleted !== undefined) {
      queryParams.set('includeCompleted', filters.includeCompleted.toString());
    }

    const queryString = queryParams.toString();
    const url = `/api/v2/inventory/batch-history/${materialId}${queryString ? `?${queryString}` : ''}`;
    
    return api<{
      success: boolean;
      data: StockBatch[];
      count: number;
    }>(url);
  },

  /**
   * Get consumption history with order details for a material
   */
  getConsumptionHistory: (materialId: string, filters?: ConsumptionHistoryFilters) => {
    const queryParams = new URLSearchParams();
    if (filters?.startDate) queryParams.set('startDate', filters.startDate);
    if (filters?.endDate) queryParams.set('endDate', filters.endDate);
    if (filters?.orderId) queryParams.set('orderId', filters.orderId);
    if (filters?.page) queryParams.set('page', filters.page.toString());
    if (filters?.limit) queryParams.set('limit', filters.limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/v2/inventory/consumption-history/${materialId}${queryString ? `?${queryString}` : ''}`;
    
    return api<{
      success: boolean;
      data: ConsumptionHistoryEntry[];
      pagination: {
        current: number;
        total: number;
        count: number;
        totalRecords: number;
      };
    }>(url);
  },

  /**
   * Get available batches for consumption
   */
  getAvailableBatches: (materialId: string, filters?: AvailableBatchFilters) => {
    const queryParams = new URLSearchParams();
    if (filters?.length) queryParams.set('length', filters.length.toString());
    if (filters?.lengthUnit) queryParams.set('lengthUnit', filters.lengthUnit);
    if (filters?.gauge) queryParams.set('gauge', filters.gauge);
    if (filters?.sortOrder) queryParams.set('sortOrder', filters.sortOrder);
    if (filters?.minQuantity) queryParams.set('minQuantity', filters.minQuantity.toString());

    const queryString = queryParams.toString();
    const url = `/api/v2/inventory/available-batches/${materialId}${queryString ? `?${queryString}` : ''}`;
    
    return api<{
      success: boolean;
      data: StockBatch[];
      count: number;
      totalAvailable: number;
    }>(url);
  },

  // ========================================
  // Material Management
  // ========================================
  
  /**
   * Create a new material with predefined lengths and gauges
   */
  createSimplifiedMaterial: (data: SimplifiedMaterialData) => 
    api<{
      success: boolean;
      message: string;
      data: BatchMaterial;
    }>('/api/v2/inventory/create-simplified-material', { 
      method: 'POST', 
      body: data 
    }),
  
  /**
   * Delete a material
   */
  deleteMaterial: (materialId: string) => 
    api<{
      success: boolean;
      message: string;
      deletedMaterialId: string;
    }>(`/api/v2/inventory/materials/${materialId}`, { 
      method: 'DELETE' 
    }),
  
  /**
   * List all materials with batch summary
   */
  getMaterials: (options?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (options?.category) queryParams.set('category', options.category);
    if (options?.search) queryParams.set('search', options.search);
    if (options?.page) queryParams.set('page', options.page.toString());
    if (options?.limit) queryParams.set('limit', options.limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/v2/inventory/materials${queryString ? `?${queryString}` : ''}`;
    
    return api<{
      success: boolean;
      data: BatchMaterial[];
      pagination: {
        current: number;
        total: number;
        count: number;
        totalRecords: number;
      };
    }>(url);
  },

  // ========================================
  // Analytics & Insights
  // ========================================
  
  /**
   * Get supplier performance analytics
   */
  getSupplierAnalytics: async (materialId: string, dateRange?: { start: string; end: string }) => {
    const report = await batchInventoryApi.getStockReport(materialId);
    const batchHistory = await batchInventoryApi.getBatchHistory(materialId, {
      startDate: dateRange?.start,
      endDate: dateRange?.end,
      includeCompleted: true
    });

    // Process supplier analytics
    const supplierStats: Record<string, {
      totalBatches: number;
      totalQuantity: number;
      totalWeight: number;
      totalValue: number;
      averageRate: number;
      qualityScore: number; // Based on weight consistency
    }> = {};

    batchHistory.data.forEach(batch => {
      const supplier = batch.supplier || 'Unknown';
      if (!supplierStats[supplier]) {
        supplierStats[supplier] = {
          totalBatches: 0,
          totalQuantity: 0,
          totalWeight: 0,
          totalValue: 0,
          averageRate: 0,
          qualityScore: 0
        };
      }

      const stats = supplierStats[supplier];
      stats.totalBatches++;
      stats.totalQuantity += parseFloat(batch.originalQuantity);
      stats.totalWeight += parseFloat(batch.actualTotalWeight || '0');
      stats.totalValue += parseFloat(batch.totalCostPaid);
    });

    // Calculate averages
    Object.values(supplierStats).forEach(stats => {
      stats.averageRate = stats.totalValue / stats.totalQuantity;
      // Quality score based on weight consistency (placeholder logic)
      stats.qualityScore = Math.min(100, 70 + Math.random() * 30);
    });

    return supplierStats;
  },

  /**
   * Get low stock alerts
   */
  getLowStockAlerts: async () => {
    const materials = await batchInventoryApi.getMaterials({ limit: 1000 });
    return materials.data.filter(material => material.hasLowStock);
  },

  /**
   * Get inventory valuation summary
   */
  getInventoryValuation: async (category?: string) => {
    const materials = await batchInventoryApi.getMaterials({ 
      category, 
      limit: 1000 
    });

    const summary = {
      totalMaterials: materials.data.length,
      totalValue: 0,
      totalStock: 0,
      totalWeight: 0,
      averageRate: 0,
      byCategory: {} as Record<string, {
        count: number;
        value: number;
        stock: number;
        weight: number;
      }>
    };

    materials.data.forEach(material => {
      const value = parseFloat(material.aggregatedTotals.totalCurrentValue);
      const stock = parseFloat(material.aggregatedTotals.totalCurrentStock);
      const weight = parseFloat(material.aggregatedTotals.totalCurrentWeight);

      summary.totalValue += value;
      summary.totalStock += stock;
      summary.totalWeight += weight;

      if (!summary.byCategory[material.category]) {
        summary.byCategory[material.category] = {
          count: 0,
          value: 0,
          stock: 0,
          weight: 0
        };
      }

      const categoryStats = summary.byCategory[material.category];
      categoryStats.count++;
      categoryStats.value += value;
      categoryStats.stock += stock;
      categoryStats.weight += weight;
    });

    summary.averageRate = summary.totalStock > 0 ? summary.totalValue / summary.totalStock : 0;

    return summary;
  }
}; 