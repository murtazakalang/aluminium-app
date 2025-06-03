import { api } from '../api';
import { useAuthStore } from '../store/auth-store';
import { API_BASE_URL } from '../config';

export interface Invoice {
  _id: string;
  companyId: string;
  invoiceIdDisplay: string;
  orderId: string;
  orderIdDisplaySnapshot: string;
  clientId: string;
  clientSnapshot: {
    clientName: string;
    contactPerson?: string;
    contactNumber: string;
    email?: string;
    billingAddress?: string;
    siteAddress?: string;
    gstin?: string;
  };
  status: 'Draft' | 'Sent' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Void';
  items: InvoiceItem[];
  charges: InvoiceCharge[];
  discount: {
    type: 'percentage' | 'fixed';
    value: number;
  };
  subtotal: number;
  totalCharges: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  payments: Payment[];
  invoiceDate: string;
  dueDate?: string;
  termsAndConditions?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  _id?: string;
  productTypeId: string;
  productTypeNameSnapshot: string;
  finalWidth: number;
  finalHeight: number;
  finalQuantity: number;
  itemLabel?: string;
  finalChargeableAreaPerItem: number;
  finalTotalChargeableArea: number;
  pricePerAreaUnit: number;
  finalItemSubtotal: number;
}

export interface InvoiceCharge {
  _id?: string;
  description: string;
  amount: number;
  isTax?: boolean;
  isPredefined?: boolean;
}

export interface Payment {
  _id?: string;
  paymentDate: string;
  amount: number;
  method: string;
  reference?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface PaymentFormData {
  paymentDate: string;
  amount: number;
  method: string;
  reference?: string;
}

export interface InvoiceListResponse {
  status: string;
  data: {
    invoices: Invoice[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface InvoiceResponse {
  status: string;
  data: {
    invoice: Invoice;
  };
}

export interface InvoiceFilters {
  status?: string;
  clientId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const invoiceApi = {
  // Create invoice from order
  createInvoiceFromOrder: async (orderId: string): Promise<InvoiceResponse> => {
    return await api<InvoiceResponse>(`/api/invoices/from-order/${orderId}`, {
      method: 'POST'
    });
  },

  // List invoices with optional filters
  getInvoices: async (params?: InvoiceFilters): Promise<InvoiceListResponse> => {
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
    const endpoint = queryString ? `/api/invoices?${queryString}` : '/api/invoices';
    
    return await api<InvoiceListResponse>(endpoint);
  },

  // Get specific invoice
  getInvoice: async (invoiceId: string): Promise<InvoiceResponse> => {
    return await api<InvoiceResponse>(`/api/invoices/${invoiceId}`);
  },

  // Generate PDF for invoice
  getInvoicePdf: async (invoiceId: string): Promise<Blob> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}/pdf`, {
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

  // Record payment against invoice
  recordPayment: async (invoiceId: string, paymentData: PaymentFormData): Promise<InvoiceResponse> => {
    return await api<InvoiceResponse>(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: paymentData
    });
  }
};

export default invoiceApi; 