import { api } from '../api';
import { useAuthStore } from '../store/auth-store';
import { API_BASE_URL } from '../config';
import { 
  Quotation, 
  QuotationFormData, 
  QuotationFilters,
  QuotationItem,
  QuotationCharge,
  QuotationDiscount,
  ClientSnapshot
} from '../types';

export interface QuotationListResponse {
  status: string;
  data: {
    quotations: Quotation[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface QuotationResponse {
  status: string;
  data: {
    quotation: Quotation;
  };
}

export interface SVGItemResponse {
  itemId: string;
  productType: string;
  dimensions: {
    width: number;
    height: number;
    unit: string;
  };
  quantity: number;
  itemLabel?: string;
  svgContent: string;
}

export interface AllItemsSVGResponse {
  status: string;
  data: {
    quotationId: string;
    quotationIdDisplay: string;
    items: SVGItemResponse[];
  };
}

export const quotationApi = {
  // List quotations with optional filters
  listQuotations: async (params?: QuotationFilters): Promise<QuotationListResponse> => {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.search) queryParams.append('search', params.search);
      if (params.status) queryParams.append('status', params.status);
      if (params.clientId) queryParams.append('clientId', params.clientId);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/quotations?${queryString}` : '/api/quotations';
    
    return await api<QuotationListResponse>(endpoint);
  },

  // Get a specific quotation by ID
  getQuotation: async (quotationId: string): Promise<QuotationResponse> => {
    return await api<QuotationResponse>(`/api/quotations/${quotationId}`);
  },

  // Create a new quotation
  createQuotation: async (quotationData: QuotationFormData): Promise<QuotationResponse> => {
    return await api<QuotationResponse>('/api/quotations', { 
      method: 'POST', 
      body: quotationData 
    });
  },

  // Update an existing quotation
  updateQuotation: async (quotationId: string, quotationData: QuotationFormData): Promise<QuotationResponse> => {
    return await api<QuotationResponse>(`/api/quotations/${quotationId}`, { 
      method: 'PUT', 
      body: quotationData 
    });
  },

  // Delete a quotation
  deleteQuotation: async (quotationId: string): Promise<{ status: string; data: null }> => {
    return await api<{ status: string; data: null }>(`/api/quotations/${quotationId}`, { 
      method: 'DELETE' 
    });
  },

  // Send a quotation (change status to Sent)
  sendQuotation: async (quotationId: string): Promise<QuotationResponse> => {
    return await api<QuotationResponse>(`/api/quotations/${quotationId}/send`, { 
      method: 'POST' 
    });
  },

  // Update quotation status
  updateStatus: async (quotationId: string, status: string): Promise<QuotationResponse> => {
    return await api<QuotationResponse>(`/api/quotations/${quotationId}/status`, { 
      method: 'PUT', 
      body: { status } 
    });
  },

  // Generate PDF for a quotation
  generatePDF: async (quotationId: string): Promise<Blob> => {
    const token = useAuthStore.getState().token;
    
    const response = await fetch(`${API_BASE_URL}/api/quotations/${quotationId}/pdf`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept': 'application/pdf'
      }
    });
    
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.message || `Failed to generate PDF: ${response.statusText}`);
      }
      throw new Error(`Failed to generate PDF: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    if (blob.size === 0) {
      throw new Error('Generated PDF is empty');
    }
    
    return blob;
  },

  // Generate SVG for a specific quotation item
  generateItemSVG: async (quotationId: string, itemId: string): Promise<string> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/api/quotations/${quotationId}/svg/${itemId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate SVG: ${response.statusText}`);
    }
    
    return await response.text(); // Return SVG as text
  },

  // Generate SVGs for all quotation items
  generateAllItemsSVG: async (quotationId: string): Promise<AllItemsSVGResponse> => {
    return await api<AllItemsSVGResponse>(`/api/quotations/${quotationId}/svg`);
  },

  // Generate layout SVG for all quotation items
  generateLayoutSVG: async (quotationId: string, layout: 'grid' | 'vertical' | 'horizontal' = 'grid'): Promise<string> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/api/quotations/${quotationId}/svg/layout?layout=${layout}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate layout SVG: ${response.statusText}`);
    }
    
    return await response.text(); // Return SVG as text
  },

  // Send quotation PDF via Email
  sendQuotationByEmail: async (quotationId: string, emailBody?: string): Promise<{ status: string; message: string }> => {
    return await api<{ status: string; message: string }>(`/api/quotations/${quotationId}/send-email`, {
      method: 'POST',
      body: { emailBody } // Send emailBody in the request
    });
  }
};

export default quotationApi; 