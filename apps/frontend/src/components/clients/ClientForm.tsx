import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Client, ClientFormData } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormInput } from '@/components/ui/FormInput';

interface ClientFormProps {
  initialValues?: Partial<Client>;
  onSubmit: (data: ClientFormData) => Promise<void>;
  isLoading?: boolean;
  isEditMode?: boolean;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  initialValues = {},
  onSubmit,
  isLoading = false,
  isEditMode = false,
}) => {
  const router = useRouter();
  const extractStreet = (addr: any) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return addr.street || '';
  };
  const [formData, setFormData] = useState<ClientFormData>({
    clientName: initialValues.clientName || '',
    contactPerson: initialValues.contactPerson || '',
    contactNumber: initialValues.contactNumber || '',
    email: initialValues.email || '',
    billingAddress: extractStreet(initialValues.billingAddress),
    siteAddress: extractStreet(initialValues.siteAddress),
    gstin: initialValues.gstin || '',
    leadSource: initialValues.leadSource || '',
    followUpStatus: initialValues.followUpStatus || 'New Lead',
    isActive: initialValues.isActive !== undefined ? initialValues.isActive : true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required';
    }
    
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email format is invalid';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked
        : value
    }));
    
    // Clear error for this field when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await onSubmit(formData);
      router.push('/dashboard/clients');
    } catch (error) {
      // Handle submission error
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormInput
          label="Client Name"
          name="clientName"
          value={formData.clientName}
          onChange={handleChange}
          error={errors.clientName}
          required
        />
        
        <FormInput
          label="Contact Person"
          name="contactPerson"
          value={formData.contactPerson}
          onChange={handleChange}
          error={errors.contactPerson}
        />
        
        <FormInput
          label="Contact Number"
          name="contactNumber"
          type="tel"
          value={formData.contactNumber}
          onChange={handleChange}
          error={errors.contactNumber}
          required
        />
        
        <FormInput
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
        />
        
        <div className="md:col-span-2">
          <FormInput
            label="Billing Address"
            name="billingAddress"
            value={formData.billingAddress}
            onChange={handleChange}
            error={errors.billingAddress}
          />
        </div>
        
        <div className="md:col-span-2">
          <FormInput
            label="Site Address"
            name="siteAddress"
            value={formData.siteAddress}
            onChange={handleChange}
            error={errors.siteAddress}
          />
        </div>
        
        <FormInput
          label="GSTIN"
          name="gstin"
          value={formData.gstin}
          onChange={handleChange}
          error={errors.gstin}
        />
        
        <FormInput
          label="Lead Source"
          name="leadSource"
          value={formData.leadSource}
          onChange={handleChange}
          error={errors.leadSource}
          placeholder="e.g., Website, Referral, etc."
        />
        
        <div>
          <label htmlFor="followUpStatus" className="block text-sm font-medium text-gray-700">
            Follow-up Status
          </label>
          <select
            id="followUpStatus"
            name="followUpStatus"
            value={formData.followUpStatus}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="New Lead">New Lead</option>
            <option value="In Discussion">In Discussion</option>
            <option value="Quoted">Quoted</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Converted">Converted</option>
            <option value="Dropped">Dropped</option>
          </select>
        </div>
        
        <div className="flex items-center">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
            Active Client
          </label>
        </div>
      </div>
      
      <div className="flex justify-end space-x-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => router.push('/dashboard/clients')}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : isEditMode ? 'Update Client' : 'Add Client'}
        </Button>
      </div>
    </form>
  );
};

export default ClientForm; 