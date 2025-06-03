import { api } from '../api';

// Type definitions for report data
export interface ClientReportData {
  totalClients: number;
  totalQuotationValue: number;
  totalOrderValue: number;
  overallConversionRate: number;
  statusSummary: Record<string, { count: number; value: number }>;
  leadSourceSummary: Record<string, { count: number; value: number }>;
  topClients: Array<{
    _id: string;
    clientName: string;
    quotationValue: number;
    orderValue: number;
    conversionRate: number;
  }>;
}

export interface QuotationReportData {
  summary: {
    totalQuotations: number;
    totalValue: number;
    conversionRate: number;
    averageQuotationValue: number;
  };
  statusBreakdown: Record<string, { count: number; value: number }>;
  monthlyTrends: Array<{
    month: string;
    totalQuotations: number;
    totalValue: number;
    conversionRate: number;
  }>;
  topQuotations: Array<{
    _id: string;
    quotationIdDisplay: string;
    clientName: string;
    grandTotal: number;
    status: string;
    createdAt: string;
  }>;
  productAnalysis: Array<{
    _id: string;
    productName: string;
    count: number;
    totalValue: number;
  }>;
}

export interface SalesOrderReportData {
  summary: {
    totalOrders: number;
    totalValue: number;
    completionRate: number;
    averageOrderValue: number;
    inProductionOrders: number;
  };
  statusBreakdown: Record<string, { count: number; value: number }>;
  monthlyTrends: Array<{
    month: string;
    totalOrders: number;
    totalValue: number;
    completionRate: number;
  }>;
  topOrders: Array<{
    _id: string;
    orderIdDisplay: string;
    clientName: string;
    finalGrandTotal: number;
    status: string;
    createdAt: string;
  }>;
  productAnalysis: Array<{
    _id: string;
    productName: string;
    count: number;
    totalValue: number;
  }>;
}

export interface InventoryReportData {
  summary: {
    totalMaterials: number;
    totalStockValue: number;
    lowStockItems: number;
    categoryTotals: Record<string, { count: number; value: number }>;
  };
  profileDetails: Array<{
    _id: {
      materialName: string;
      length: number;
      unit: string;
    };
    quantity: number;
    unitRate: number;
    stockValue: number;
    isLowStock: boolean;
  }>;
  nonProfileDetails: Array<{
    _id: string;
    materialName: string;
    category: string;
    totalStockQuantity: number;
    stockUnit: string;
    unitRate: number;
    stockValue: number;
    isLowStock: boolean;
  }>;
  categoryBreakdown: Array<{
    _id: string;
    totalMaterials: number;
    totalStockValue: number;
    lowStockItems: number;
  }>;
}

export interface ManufacturingReportData {
  summary: {
    totalPlans: number;
    overallEfficiencyPercentage: number;
    averageScrapPercentage: number;
    totalPipesUsed: number;
  };
  materialPerformance: Array<{
    _id: string;
    materialName: string;
    totalPlans: number;
    totalPipesUsed: number;
    averageEfficiencyPercentage: number;
    averageScrapPercentage: number;
    totalScrapLength: number;
    scrapUnit: string;
  }>;
  lengthUtilization: Array<{
    _id: number;
    standardLength: number;
    unit: string;
    totalUsed: number;
    totalScrap: number;
    efficiencyPercentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    totalPlans: number;
    averageEfficiency: number;
    averageScrap: number;
  }>;
}

export interface DashboardOverviewData {
  clients: {
    total: number;
    conversionRate: number;
    topClients: Array<{
      _id: string;
      clientName: string;
      quotationValue: number;
    }>;
  };
  quotations: {
    total: number;
    totalValue: number;
    conversionRate: number;
    recentTrend: Array<{
      month: string;
      totalValue: number;
    }>;
  };
  orders: {
    total: number;
    totalValue: number;
    completionRate: number;
    inProduction: number;
  };
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    categoryBreakdown: Record<string, { count: number; value: number }>;
  };
  manufacturing: {
    totalPlans: number;
    averageEfficiency: number;
    averageScrap: number;
    topMaterials: Array<{
      _id: string;
      materialName: string;
      averageEfficiencyPercentage: number;
    }>;
  };
}

// API parameters interface
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  leadSource?: string;
  clientId?: string;
  category?: string;
  lowStockOnly?: boolean;
  materialId?: string;
}

export const reportingApi = {
  /**
   * Fetch client analytics report
   */
  fetchClientReport: (filters?: ReportFilters) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/reports/clients?${queryString}` : '/api/reports/clients';
    
    return api<{success: boolean; data: ClientReportData}>(endpoint);
  },

  /**
   * Fetch quotation analytics report
   */
  fetchQuotationReport: (filters?: ReportFilters) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/reports/quotations?${queryString}` : '/api/reports/quotations';
    
    return api<{success: boolean; data: QuotationReportData}>(endpoint);
  },

  /**
   * Fetch sales order analytics report
   */
  fetchSalesOrderReport: (filters?: ReportFilters) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/reports/sales-orders?${queryString}` : '/api/reports/sales-orders';
    
    return api<{success: boolean; data: SalesOrderReportData}>(endpoint);
  },

  /**
   * Fetch inventory analytics report
   */
  fetchInventoryReport: (filters?: ReportFilters) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/reports/inventory?${queryString}` : '/api/reports/inventory';
    
    return api<{success: boolean; data: InventoryReportData}>(endpoint);
  },

  /**
   * Fetch manufacturing analytics report
   */
  fetchManufacturingReport: (filters?: ReportFilters) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/reports/manufacturing?${queryString}` : '/api/reports/manufacturing';
    
    return api<{success: boolean; data: ManufacturingReportData}>(endpoint);
  },

  /**
   * Fetch dashboard overview with combined metrics
   */
  fetchDashboardOverview: (filters?: ReportFilters) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/reports/dashboard?${queryString}` : '/api/reports/dashboard';
    
    return api<{success: boolean; data: DashboardOverviewData}>(endpoint);
  },
}; 