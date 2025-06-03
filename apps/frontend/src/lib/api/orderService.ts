import { api } from '../api';
import { useAuthStore } from '@/lib/store/auth-store';
import { API_BASE_URL } from '@/lib/config';

export interface OrderItem {
  _id?: string;
  productTypeId: string;
  productTypeNameSnapshot?: string;
  originalWidth?: number;
  finalWidth: number;
  originalHeight?: number;
  finalHeight: number;
  originalQuantity?: number;
  finalQuantity: number;
  itemLabel?: string;
  selectedGlassTypeNameSnapshot?: string;
  frameColour?: string;
  finalChargeableAreaPerItem?: number;
  finalTotalChargeableArea?: number;
  pricePerAreaUnit: number;
  finalItemSubtotal?: number;
  requiredMaterialCuts?: RequiredMaterialCut[];
}

export interface RequiredMaterialCut {
  materialId: string;
  materialNameSnapshot: string;
  gaugeSnapshot?: string;
  cutLengths: number[];
  lengthUnit: string;
  isCutRequired: boolean;
}

export interface OrderCharge {
  _id?: string;
  description: string;
  amount: number;
  isTax?: boolean;
  isPredefined?: boolean;
}

export interface OrderDiscount {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface ClientSnapshot {
  clientName: string;
  contactPerson?: string;
  contactNumber: string;
  email?: string;
  billingAddress?: string;
  siteAddress?: string;
  gstin?: string;
}

export interface OrderHistoryEntry {
  status: string;
  notes?: string;
  updatedBy?: string | { _id?: string; firstName?: string; lastName?: string; email?: string; };
  timestamp: string;
}

export interface Order {
  _id: string;
  companyId: string;
  orderIdDisplay: string;
  quotationId: string;
  quotationIdDisplaySnapshot?: string;
  clientId: string;
  clientSnapshot: ClientSnapshot;
  status: 'Pending' | 'Measurement Confirmed' | 'Ready for Optimization' | 'Optimization Complete' | 'Optimization Failed' | 'In Production' | 'Cutting' | 'Assembly' | 'QC' | 'Packed' | 'Delivered' | 'Completed' | 'Cancelled';
  dimensionUnit: 'inches' | 'mm';
  areaUnit: 'sqft' | 'sqm';
  priceUnit: 'sqft' | 'sqm';
  items: OrderItem[];
  charges: OrderCharge[];
  discount: OrderDiscount;
  finalSubtotal: number;
  finalTotalCharges: number;
  finalTotalTax: number;
  finalGrandTotal: number;
  cuttingPlanId?: string;
  cuttingPlanStatus: 'Pending' | 'Generated' | 'Committed';
  measurementConfirmedBy?: string | { _id?: string; firstName?: string; lastName?: string; email?: string; };
  measurementConfirmedAt?: string;
  history: OrderHistoryEntry[];
  termsAndConditions?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequiredCut {
  materialId: string;
  materialName: string;
  usageUnit: string;
  category: string;
  requiredCuts: number[];
}

export interface StockItemDetail {
  length: number | string;
  count: number;
  unit: string;
}

export interface StockAvailability {
  materialId: string;
  materialName: string;
  category?: string;
  status: 'Sufficient' | 'Insufficient' | 'Material Not Found' | 'N/A (Non-Profile)' | 'Pending Detailed Check' | 'Sufficient (Simplified Check)' | 'Insufficient (Simplified Check)' | 'More Scrap if Use Xft';
  usageUnit: string;
  requiredCutsDetail: StockItemDetail[];
  availableStockDetail: StockItemDetail[];
  shortfallDetail: StockItemDetail[];
}

export interface MeasurementConfirmationData {
  items: {
    itemId: string;
    finalWidth: number;
    finalHeight: number;
    finalQuantity: number;
  }[];
}

export interface OrderFilters {
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const orderApi = {
  // Create order from quotation
  createFromQuotation: (quotationId: string) =>
    api<{ data: { order: Order } }>(`/api/orders/from-quotation/${quotationId}`, {
      method: 'POST',
    }),

  // List orders with filters
  listOrders: (filters?: OrderFilters) => {
    const queryParams = new URLSearchParams();
    if (filters) {
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.page) queryParams.append('page', filters.page.toString());
      if (filters.limit) queryParams.append('limit', filters.limit.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/orders?${queryString}` : '/api/orders';

    return api<{ data: { orders: Order[] }; results: number }>(endpoint);
  },

  // Get order by ID
  getOrder: (orderId: string) =>
    api<{ data: { order: Order } }>(`/api/orders/${orderId}`),

  // Confirm measurements
  confirmMeasurements: (orderId: string, data: MeasurementConfirmationData) =>
    api<{ data: { order: Order } }>(`/api/orders/${orderId}/confirm-measurements`, {
      method: 'PUT',
      body: data,
    }),

  // Get required cuts
  getRequiredCuts: (orderId: string) =>
    api<{ data: { requiredCuts: RequiredCut[] } }>(`/api/orders/${orderId}/required-cuts`),

  // Check stock availability for an order
  checkStock: async (orderId: string) => {
    const response = await api<{ data: { detailedStockAvailability: StockAvailability[] } }>(`/api/orders/${orderId}/check-stock`, {
      method: 'POST',
    });
    return response;
  },

  // Generate stock availability check PDF
  generateStockCheckPDF: async (orderId: string): Promise<Blob> => {
    try {
      const token = useAuthStore.getState().token;
      
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/stock-check-pdf`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      return blob;
    } catch (error) {
      throw error;
    }
  },

  // Update order status
  updateStatus: (orderId: string, status: string, notes?: string) =>
    api<{ data: { order: Order } }>(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: { status, notes },
    }),

  // Get order history
  getHistory: (orderId: string) =>
    api<{ data: { orderIdDisplay: string; history: OrderHistoryEntry[] } }>(`/api/orders/${orderId}/history`),
}; 