'use client';

import React, { useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import ChargesTable from '@/components/settings/ChargesTable';
import ChargeForm from '@/components/settings/ChargeForm';
import { ChargeType } from '@/contexts/SettingsContext';
import { api } from '@/lib/api';

const ChargesPage = () => {
  const { settings, fetchSettings } = useSettings();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentCharge, setCurrentCharge] = useState<ChargeType | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = (charge: ChargeType) => {
    setCurrentCharge(charge);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setCurrentCharge(undefined);
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setCurrentCharge(undefined);
  };

  const handleSubmit = async (charge: Omit<ChargeType, '_id'> & { _id?: string }) => {
    setLoading(true);
    setError(null);
    try {
      if (charge._id) {
        // Update existing charge
        await api<any>(`/api/settings/charges/${charge._id}`, {
          method: 'PUT',
          body: { name: charge.name, isDefault: charge.isDefault },
        });
      } else {
        // Create new charge
        await api<any>('/api/settings/charges', {
          method: 'POST',
          body: { name: charge.name, isDefault: charge.isDefault },
        });
      }
      
      // Refresh settings to update the charges list
      await fetchSettings();
      setIsFormOpen(false);
      setCurrentCharge(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save charge');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (chargeId: string) => {
    if (!window.confirm('Are you sure you want to delete this charge?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api<any>(`/api/settings/charges/${chargeId}`, {
        method: 'DELETE',
      });
      
      // Refresh settings to update the charges list
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete charge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Predefined Charges</h2>
          <p className="text-muted-foreground">
            Manage charges that can be automatically added to quotations and invoices.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          disabled={loading}
        >
          Add New Charge
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
          {error}
        </div>
      )}

      {isFormOpen ? (
        <div className="rounded-lg border bg-card shadow">
          <ChargeForm
            charge={currentCharge}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <ChargesTable
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
};

export default ChargesPage; 