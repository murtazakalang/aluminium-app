import React, { useState, useEffect } from 'react';
import { FiFilter, FiDownload, FiCalendar } from 'react-icons/fi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { batchInventoryApi } from '@/lib/api/batchInventoryService';

interface Material {
  _id: string;
  name: string;
  category: string;
}

interface StockTransaction {
  _id: string;
  materialId: string;
  type: 'Inward' | 'Outward-Manual' | 'Outward-OrderCut' | 'Scrap' | 'Correction';
  length: string;
  lengthUnit: string;
  quantityChange: string;
  quantityUnit: string;
  relatedDocumentType?: string;
  relatedDocumentId?: string;
  notes?: string;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  transactionDate: string;
}

interface StockHistoryTableProps {
  transactions: StockTransaction[];
  materials: Material[];
  isLoading: boolean;
  onMaterialFilter: (materialId: string | null) => void;
  onTypeFilter: (type: string | null) => void;
  onDateRangeFilter: (startDate: string | null, endDate: string | null) => void;
  onExport: () => void;
}

export default function StockHistoryTable({
  transactions,
  materials,
  isLoading,
  onMaterialFilter,
  onTypeFilter,
  onDateRangeFilter,
  onExport,
}: StockHistoryTableProps) {
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const handleMaterialChange = (materialId: string | null) => {
    setSelectedMaterial(materialId);
    onMaterialFilter(materialId);
  };

  const handleTypeChange = (type: string | null) => {
    setSelectedType(type);
    onTypeFilter(type);
  };

  const handleDateFilter = () => {
    onDateRangeFilter(startDate || null, endDate || null);
  };

  const handleResetFilters = () => {
    setSelectedMaterial(null);
    setSelectedType(null);
    setStartDate('');
    setEndDate('');
    onMaterialFilter(null);
    onTypeFilter(null);
    onDateRangeFilter(null, null);
  };

  const getMaterialName = (materialId: string): string => {
    const material = materials.find((m) => m._id === materialId);
    return material?.name || 'Unknown Material';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'Inward':
        return 'Inward (Add)';
      case 'Outward-Manual':
        return 'Outward (Manual)';
      case 'Outward-OrderCut':
        return 'Outward (Order Cut)';
      case 'Scrap':
        return 'Scrap';
      case 'Correction':
        return 'Correction';
      default:
        return type;
    }
  };

  const getQuantityWithSign = (transaction: StockTransaction): string => {
    const isOutward = transaction.type.startsWith('Outward') || transaction.type === 'Scrap';
    const sign = isOutward ? '-' : '+';
    return `${sign}${transaction.quantityChange} ${transaction.quantityUnit}`;
  };

  const columns = [
    {
      header: 'Date & Time',
      accessor: (transaction: StockTransaction) => formatDate(transaction.transactionDate),
    },
    {
      header: 'Material',
      accessor: (transaction: StockTransaction) => getMaterialName(transaction.materialId),
    },
    {
      header: 'Length',
      accessor: (transaction: StockTransaction) => `${transaction.length} ${transaction.lengthUnit}`,
    },
    {
      header: 'Type',
      accessor: (transaction: StockTransaction) => (
        <span className={transaction.type.startsWith('Outward') || transaction.type === 'Scrap' ? 'text-red-600' : 'text-green-600'}>
          {getTypeLabel(transaction.type)}
        </span>
      ),
    },
    {
      header: 'Quantity Change',
      accessor: (transaction: StockTransaction) => (
        <span className={transaction.type.startsWith('Outward') || transaction.type === 'Scrap' ? 'text-red-600' : 'text-green-600'}>
          {getQuantityWithSign(transaction)}
        </span>
      ),
    },
    {
      header: 'Notes',
      accessor: (transaction: StockTransaction) => transaction.notes || '-',
    },
    {
      header: 'Updated By',
      accessor: (transaction: StockTransaction) => 
        transaction.createdBy 
          ? `${transaction.createdBy.firstName} ${transaction.createdBy.lastName}`
          : '-',
    },
  ];

  const types = [
    { value: 'Inward', label: 'Inward (Add)' },
    { value: 'Outward-Manual', label: 'Outward (Manual)' },
    { value: 'Outward-OrderCut', label: 'Outward (Order Cut)' },
    { value: 'Scrap', label: 'Scrap' },
    { value: 'Correction', label: 'Correction' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FiFilter className="mr-1" /> {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
        >
          <FiDownload className="mr-1" /> Export CSV
        </Button>
      </div>

      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="materialFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Material
              </label>
              <select
                id="materialFilter"
                value={selectedMaterial || ''}
                onChange={(e) => handleMaterialChange(e.target.value || null)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All Materials</option>
                {materials.map((material) => (
                  <option key={material._id} value={material._id}>
                    {material.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="typeFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Type
              </label>
              <select
                id="typeFilter"
                value={selectedType || ''}
                onChange={(e) => handleTypeChange(e.target.value || null)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All Types</option>
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <FiCalendar className="text-gray-400" size={16} />
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Start"
                  />
                </div>
                <span className="text-gray-500">to</span>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <FiCalendar className="text-gray-400" size={16} />
                  </div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="End"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDateFilter}
                  disabled={!startDate && !endDate}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      )}

      <Table
        columns={columns}
        data={transactions}
        keyExtractor={(item) => item._id}
        isLoading={isLoading}
        emptyStateMessage="No stock transactions found. Adjust some stock to see the history."
      />
    </div>
  );
} 