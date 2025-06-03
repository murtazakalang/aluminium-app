'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { Button } from '@/components/ui/Button';
import { SaveIcon, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const TermsEditor = () => {
  const { settings, updateSettings, loading } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Local state for editing
  const [localSettings, setLocalSettings] = useState({
    termsAndConditions: {
      quotation: '',
      invoice: '',
    },
    paymentTerms: {
      quotation: '',
      invoice: '',
    },
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        termsAndConditions: {
          quotation: settings.termsAndConditions.quotation || '',
          invoice: settings.termsAndConditions.invoice || '',
        },
        paymentTerms: {
          quotation: settings.paymentTerms.quotation || '',
          invoice: settings.paymentTerms.invoice || '',
        },
      });
      setHasUnsavedChanges(false);
    }
  }, [settings]);

  const handleQuotationTermsChange = (value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      termsAndConditions: {
        ...prev.termsAndConditions,
        quotation: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleInvoiceTermsChange = (value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      termsAndConditions: {
        ...prev.termsAndConditions,
        invoice: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleQuotationPaymentTermsChange = (value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      paymentTerms: {
        ...prev.paymentTerms,
        quotation: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleInvoicePaymentTermsChange = (value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      paymentTerms: {
        ...prev.paymentTerms,
        invoice: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateSettings({
        termsAndConditions: localSettings.termsAndConditions,
        paymentTerms: localSettings.paymentTerms,
      });
      setHasUnsavedChanges(false);
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings. Please try again.');
      console.error('Save settings error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setLocalSettings({
        termsAndConditions: {
          quotation: settings.termsAndConditions.quotation || '',
          invoice: settings.termsAndConditions.invoice || '',
        },
        paymentTerms: {
          quotation: settings.paymentTerms.quotation || '',
          invoice: settings.paymentTerms.invoice || '',
        },
      });
      setHasUnsavedChanges(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Save Actions Bar */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">
                You have unsaved changes
              </span>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">
                All changes saved
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleReset}
            disabled={!hasUnsavedChanges || isSaving}
            size="sm"
          >
            Reset Changes
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving || loading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <SaveIcon className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* Terms & Conditions Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Terms & Conditions</h3>
          <p className="text-sm text-gray-500">
            Configure the default terms and conditions for quotations and invoices.
          </p>
        </div>

        <div className="grid gap-6">
          <div>
            <RichTextEditor
              label="Quotation Terms & Conditions"
              value={localSettings.termsAndConditions.quotation}
              onChange={handleQuotationTermsChange}
              placeholder="Enter the terms and conditions for quotations..."
              className="mb-4"
            />
            <p className="text-sm text-gray-500">
              These terms will be included in all quotations by default.
            </p>
          </div>

          <div>
            <RichTextEditor
              label="Invoice Terms & Conditions"
              value={localSettings.termsAndConditions.invoice}
              onChange={handleInvoiceTermsChange}
              placeholder="Enter the terms and conditions for invoices..."
              className="mb-4"
            />
            <p className="text-sm text-gray-500">
              These terms will be included in all invoices by default.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Terms Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Payment Terms</h3>
          <p className="text-sm text-gray-500">
            Configure the default payment terms for quotations and invoices.
          </p>
        </div>

        <div className="grid gap-6">
          <div>
            <RichTextEditor
              label="Quotation Payment Terms"
              value={localSettings.paymentTerms.quotation}
              onChange={handleQuotationPaymentTermsChange}
              placeholder="Enter the payment terms for quotations..."
              className="mb-4"
            />
            <p className="text-sm text-gray-500">
              These payment terms will be displayed in all quotations.
            </p>
          </div>

          <div>
            <RichTextEditor
              label="Invoice Payment Terms"
              value={localSettings.paymentTerms.invoice}
              onChange={handleInvoicePaymentTermsChange}
              placeholder="Enter the payment terms for invoices..."
              className="mb-4"
            />
            <p className="text-sm text-gray-500">
              These payment terms will be displayed in all invoices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsEditor; 