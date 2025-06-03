import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from '@/lib/config';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  companyId: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>; // Return success boolean
  register: (registrationData: any) => Promise<boolean>; // Return success boolean
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || errorData.errors?.[0]?.msg || 'Failed to login');
          }

          const data = await response.json();
          
          // Verify that we have all the required data before setting authenticated state
          if (!data.token || !data.data?.user || !data.data.user._id) {
            throw new Error('Invalid response from server');
          }
          
          set({ 
            token: data.token, 
            user: data.data.user, 
            isAuthenticated: true, 
            isLoading: false 
          });
          
          return true; // Success
        } catch (error) {
          set({ 
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false, 
            error: error instanceof Error ? error.message : 'An error occurred during login' 
          });
          return false; // Failed
        }
      },

      register: async (registrationData) => {
        try {
          set({ isLoading: true, error: null });
          const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationData),
          });

          if (response.ok) {
            const data = await response.json();
            
            // Verify that we have all the required data
            if (!data.token || !data.data?.user || !data.data.user._id) {
              throw new Error('Invalid response from server');
            }
            
            set({ 
              token: data.token, 
              user: {
                id: data.data.user._id,
                email: data.data.user.email,
                firstName: data.data.user.firstName,
                lastName: data.data.user.lastName,
                role: data.data.user.role,
                companyId: data.data.user.companyId
              }, 
              isAuthenticated: true, 
              isLoading: false 
            });
            
            return true; // Success
          } else {
            const errorData = await response.json().catch(() => ({}));
            set({ 
              error: errorData.error || 'Registration failed',
              isLoading: false 
            });
            throw new Error(errorData.error || 'Registration failed');
          }
        } catch (error: any) {
          set({ 
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false, 
            error: error instanceof Error ? error.message : 'An error occurred during registration' 
          });
          return false; // Failed
        }
      },

      forgotPassword: async (email: string) => {
        try {
          set({ isLoading: true, error: null });
          const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          });

          if (response.ok) {
            set({ isLoading: false });
          } else {
            const errorData = await response.json().catch(() => ({}));
            set({ 
              error: errorData.error || 'Failed to send password reset email',
              isLoading: false 
            });
            throw new Error(errorData.error || 'Failed to send password reset email');
          }
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'An error occurred while sending reset email' 
          });
        }
      },

      resetPassword: async (token: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          const response = await fetch(`${API_BASE_URL}/api/auth/reset-password/${token}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password }),
          });

          if (response.ok) {
            set({ isLoading: false });
          } else {
            const errorData = await response.json().catch(() => ({}));
            set({ 
              error: errorData.error || 'Failed to reset password',
              isLoading: false 
            });
            throw new Error(errorData.error || 'Failed to reset password');
          }
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'An error occurred while resetting password' 
          });
        }
      },

      logout: () => {
        // Call logout API if needed
        set({ token: null, user: null, isAuthenticated: false });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        token: state.token, 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
); 