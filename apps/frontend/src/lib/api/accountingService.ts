import { api } from '../api';

export interface SalesLedgerEntry {
  _id: string;
  type: 'Invoice' | 'Payment';
  date: string;
  invoiceId?: string;
  invoiceIdDisplay?: string;
  clientName: string;
  description: string;
  debitAmount?: number; // For invoices
  creditAmount?: number; // For payments
  balance: number;
  runningBalance: number;
}

export interface SalesLedgerResponse {
  status: string;
  data: {
    invoices: any[]; // Using any[] for now, ideally map to a more specific Invoice-like type for entries
    summary: {
      _id: string | null;
      totalInvoices: number;      // Count of invoices
      totalInvoiceAmount: number; // Corresponds to frontend's totalInvoiced expectation
      totalAmountPaid: number;    // Corresponds to frontend's totalPaid expectation
      totalBalanceDue: number;    // Corresponds to frontend's outstandingBalance expectation
      // Add other fields from your log's summary if needed, e.g., overdueAmount might be here or calculated
    };
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalResults: number;
      resultsPerPage: number;
    };
    recentPayments?: any[]; // Structure not detailed, using any[]
  };
}

export interface PnLSimpleEntry {
  category: string;
  subcategory?: string;
  amount: number;
  percentage?: number;
}

export interface PnLSimpleResponse {
  status: string;
  data: {
    period: {
      startDate: string;
      endDate: string;
    };
    revenue: {
      totalInvoiced: number;
      entries: PnLSimpleEntry[];
    };
    costs: {
      totalCosts: number;
      entries: PnLSimpleEntry[];
    };
    summary: {
      grossProfit: number;
      grossMargin: number;
      netProfit: number;
      netMargin: number;
    };
  };
}

export interface SalesLedgerFilters {
  clientId?: string;
  startDate?: string;
  endDate?: string;
  type?: 'Invoice' | 'Payment';
  page?: number;
  limit?: number;
}

export interface PnLFilters {
  startDate?: string;
  endDate?: string;
  groupBy?: 'month' | 'quarter' | 'year';
}

export const accountingApi = {
  // Get sales ledger data with optional filters
  getSalesLedger: async (params?: SalesLedgerFilters): Promise<SalesLedgerResponse> => {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.clientId) queryParams.append('clientId', params.clientId);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.type) queryParams.append('type', params.type);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/accounting/sales-ledger?${queryString}` : '/api/accounting/sales-ledger';
    
    return await api<SalesLedgerResponse>(endpoint);
  },

  // Get simple P&L report
  getPnLSimple: async (params?: PnLFilters): Promise<PnLSimpleResponse> => {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.groupBy) queryParams.append('groupBy', params.groupBy);
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/accounting/pnl-simple?${queryString}` : '/api/accounting/pnl-simple';
    
    return await api<PnLSimpleResponse>(endpoint);
  }
};

export default accountingApi; 