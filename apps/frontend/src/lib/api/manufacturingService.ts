import { api } from '../api';

export interface CuttingPlan {
  _id: string;
  orderId: string;
  orderIdDisplay: string;
  companyId: string;
  generatedBy: string;
  materialPlans: MaterialPlan[];
  summary: {
    totalWeight: number;
    totalScrapWeight: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MaterialPlan {
  materialId: string;
  materialNameSnapshot: string;
  gaugeSnapshot?: string;
  pipesUsed: PipeUsed[];
}

export interface PipeUsed {
  standardLength: number;
  standardLengthUnit: string;
  cutsMade: { length: number; unit: string }[];
  scrapGenerated: number;
  calculatedWeight?: number;
}

export interface PipeOrderSummary {
  materialNameSnapshot: string;
  gaugeSnapshot: string;
  totalPipesPerLength: {
    length: string;
    unit: string;
    quantity: number;
    totalScrap: string;
    scrapUnit?: string;
  }[];
  totalWeight: string;
}

export const manufacturingApi = {
  // Optimize cuts for a given order
  optimizeCuts: (orderId: string) =>
    api<{ data: { cuttingPlan: CuttingPlan } }>(`/api/manufacturing/optimize-cuts`, {
      method: 'POST',
      body: { orderId },
    }),

  // Get cutting plan for an order
  getCuttingPlan: (orderId: string) =>
    api<{ data: { cuttingPlan: CuttingPlan } }>(`/api/manufacturing/orders/${orderId}/cutting-plan`),

  // Get SVG visualization of the cutting plan
  getCuttingPlanSvg: async (orderId: string) => {
    const { useAuthStore } = await import('@/lib/store/auth-store');
    const token = useAuthStore.getState().token;
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/manufacturing/orders/${orderId}/cutting-plan/svg`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgText = await response.text();
    return { data: { svg: svgText } };
  },

  // Download cutting plan as PDF
  downloadCuttingPlanPdf: async (orderId: string) => {
    const { useAuthStore } = await import('@/lib/store/auth-store');
    const token = useAuthStore.getState().token;
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/manufacturing/orders/${orderId}/cutting-plan/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return blob;
  },

  // Get pipe order summary
  getPipeOrderSummary: (orderId: string) =>
    api<{ data: { summary: PipeOrderSummary[] } }>(`/api/manufacturing/orders/${orderId}/pipe-order-summary`),

  // Update manufacturing stage
  updateStage: (orderId: string, status: string, notes?: string) =>
    api<{ data: { order: any } }>(`/api/manufacturing/orders/${orderId}/stage`, {
      method: 'PUT',
      body: { status, notes },
    }),

  // Commit cuts (deduct from inventory)
  commitCuts: (orderId: string) =>
    api<{ data: { order: any; cuttingPlan: any }; message: string }>(`/api/manufacturing/orders/${orderId}/commit-cuts`, {
      method: 'POST',
    }),

  // Get orders ready for manufacturing
  getManufacturingQueue: (filters?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.page) queryParams.append('page', filters.page.toString());
      if (filters.limit) queryParams.append('limit', filters.limit.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = queryString 
      ? `/api/manufacturing/queue?${queryString}` 
      : '/api/manufacturing/queue';

    return api<{ data: { orders: any[] }; results: number }>(endpoint);
  },
}; 