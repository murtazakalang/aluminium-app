import { API_BASE_URL } from '@/lib/config';
import { useAuthStore } from '@/lib/store/auth-store';

// Import API services
export { productApi } from './api/productService';
export { quotationApi } from './api/quotationService';
export { orderApi } from './api/orderService';
export { reportingApi } from './api/reportingService';
export { dashboardService } from './api/dashboardService';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const { method = 'GET', body, headers = {} } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || errorData.error || `API request failed with status ${response.status}`
    );
  }

  // If the response is 204 No Content, return null as there is no body to parse.
  if (response.status === 204) {
    return null as T; // Cast to T as the function expects a Promise<T>
  }

  const jsonResponse = await response.json();
  return jsonResponse;
}

// Company API
export const companyApi = {
  getMyCompany: () => api<any>('/api/companies/my'),
  updateMyCompany: (companyData: any) => api<any>('/api/companies/my', { method: 'PUT', body: companyData }),
  
  // Logo upload and removal
  uploadLogo: async (logoFile: File) => {
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    formData.append('logo', logoFile);

    const response = await fetch(`${API_BASE_URL}/api/companies/my/logo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to upload logo');
    }

    return response.json();
  },

  removeLogo: () => api<any>('/api/companies/my/logo', { method: 'DELETE' }),
};

// Staff API
export const staffApi = {
  listStaff: () => api<any[]>('/api/staff'),
  getStaff: (userId: string) => api<any>(`/api/staff/${userId}`),
  createStaff: (staffData: any) => api<any>('/api/staff', { method: 'POST', body: staffData }),
  updateStaff: (userId: string, staffData: any) => api<any>(`/api/staff/${userId}`, { method: 'PUT', body: staffData }),
  inviteStaff: (inviteData: any) => api<any>('/api/staff/invite', { method: 'POST', body: inviteData }),
  updateStatus: (userId: string, isActive: boolean) => api<any>(`/api/staff/${userId}/status`, { method: 'PUT', body: { isActive } }),
  deleteStaff: (userId: string) => api<any>(`/api/staff/${userId}`, { method: 'DELETE' }),
};

// Roles API
export const rolesApi = {
  listRoles: () => api<string[]>('/api/roles'),
};

// Settings API
export const settingsApi = {
  getSettings: () => api<any>('/api/settings'),
  updateSettings: (settingsData: any) => api<any>('/api/settings', { method: 'PUT', body: settingsData }),
  
  // Charges API
  getCharges: () => api<any[]>('/api/settings/charges'),
  createCharge: (chargeData: any) => api<any>('/api/settings/charges', { method: 'POST', body: chargeData }),
  updateCharge: (chargeId: string, chargeData: any) => api<any>(`/api/settings/charges/${chargeId}`, { method: 'PUT', body: chargeData }),
  deleteCharge: (chargeId: string) => api<any>(`/api/settings/charges/${chargeId}`, { method: 'DELETE' }),
  
  // Help and changelog
  getHelp: () => api<any>('/api/settings/help'),
  getChangelog: () => api<any>('/api/settings/changelog'),
};

// Client API
export const clientApi = {
  listClients: (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    // Build query string
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.search) queryParams.append('search', params.search);
      if (params.status) queryParams.append('status', params.status);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
    }
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/clients?${queryString}` : '/api/clients';
    
    return api<{data: any[], total: number, page: number, limit: number}>(endpoint);
  },
  getClient: (clientId: string) => 
    api<any>(`/api/clients/${clientId}`),
  createClient: (clientData: any) => 
    api<any>('/api/clients', { method: 'POST', body: clientData }),
  updateClient: (clientId: string, clientData: any) => 
    api<any>(`/api/clients/${clientId}`, { method: 'PUT', body: clientData }),
  deleteClient: (clientId: string) => 
    api<any>(`/api/clients/${clientId}`, { method: 'DELETE' }),
  addNote: (clientId: string, noteData: { text: string, reminderDate?: string }) => 
    api<any>(`/api/clients/${clientId}/notes`, { method: 'POST', body: noteData }),
  getHistory: (clientId: string) => 
    api<{ success: boolean, data: any[] }>(`/api/clients/${clientId}/history`),
  updateStatus: (clientId: string, followUpStatus: string) => 
    api<any>(`/api/clients/${clientId}/status`, { method: 'PUT', body: { followUpStatus } }),
}; 