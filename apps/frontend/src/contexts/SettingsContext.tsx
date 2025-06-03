import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

export interface ChargeType {
  _id: string;
  name: string;
  isDefault: boolean;
}

export interface SettingsData {
  termsAndConditions: {
    quotation: string;
    invoice: string;
  };
  paymentTerms: {
    quotation: string;
    invoice: string;
  };
  predefinedCharges: ChargeType[];
  gst: {
    enabled: boolean;
    percentage: number;
  };
  units: {
    dimension: 'inches' | 'mm';
    area: 'sqft' | 'sqm';
  };
  notifications: {
    systemAlertsEnabled: boolean;
    emailSummaryEnabled: boolean;
  };
}

interface SettingsContextType {
  settings: SettingsData | null;
  loading: boolean;
  error: Error | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (updatedSettings: Partial<SettingsData>) => Promise<void>;
}

const defaultSettings: SettingsData = {
  termsAndConditions: {
    quotation: '',
    invoice: '',
  },
  paymentTerms: {
    quotation: '100% Advance payment required before commencement of work. Payment can be made via bank transfer, UPI, or cash.',
    invoice: 'Payment is due within 30 days of invoice date. Late payments may incur additional charges.',
  },
  predefinedCharges: [],
  gst: {
    enabled: false,
    percentage: 0,
  },
  units: {
    dimension: 'inches',
    area: 'sqft',
  },
  notifications: {
    systemAlertsEnabled: true,
    emailSummaryEnabled: true,
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api<SettingsData>('/api/settings');
      setSettings(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
      // Set default settings if we can't fetch from server
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updatedSettings: Partial<SettingsData>) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[SettingsContext] Updating settings:', JSON.stringify(updatedSettings, null, 2));
      await api<SettingsData>('/api/settings', { 
        method: 'PUT', 
        body: updatedSettings 
      });
      console.log('[SettingsContext] Settings updated successfully');
      // Update local state
      setSettings(prev => prev ? { ...prev, ...updatedSettings } : null);
    } catch (err) {
      console.error('[SettingsContext] Failed to update settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to update settings'));
      throw err; // Re-throw to handle in the component
    } finally {
      setLoading(false);
    }
  };

  // Fetch settings on first load
  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        error,
        fetchSettings,
        updateSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 