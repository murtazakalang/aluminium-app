import React from 'react';
import { QuotationFilters } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search } from 'lucide-react';

interface QuotationFiltersProps {
  filters: QuotationFilters;
  onFiltersChange: (filters: QuotationFilters) => void;
  onSearch: () => void;
}

const QuotationFiltersComponent: React.FC<QuotationFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch
}) => {
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Sent', label: 'Sent' },
    { value: 'Viewed', label: 'Viewed' },
    { value: 'Accepted', label: 'Accepted' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Expired', label: 'Expired' },
    { value: 'Converted', label: 'Converted' },
  ];

  const handleFilterChange = (key: keyof QuotationFilters, value: string | number) => {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  const clearFilters = () => {
    onFiltersChange({
      page: 1,
      limit: filters.limit || 10,
      search: '',
      status: '',
      clientId: '',
      startDate: '',
      endDate: ''
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.status || 
    filters.clientId || 
    filters.startDate || 
    filters.endDate;

  return (
    <div className="bg-white p-4 rounded-lg border space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex flex-1">
          <Input
            type="text"
            placeholder="Search quotations..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="rounded-r-none"
          />
          <Button type="submit" variant="default" className="rounded-l-none px-3">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {/* Status Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Date Filters */}
          <div className="flex space-x-2">
            <Input
              type="date"
              placeholder="Start Date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="min-w-[140px]"
            />
            <Input
              type="date"
              placeholder="End Date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="min-w-[140px]"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              type="button"
              onClick={clearFilters}
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-sm text-gray-600">Active filters:</span>
          {filters.search && (
            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              Search: "{filters.search}"
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              Status: {filters.status}
            </span>
          )}
          {filters.startDate && (
            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
              From: {new Date(filters.startDate).toLocaleDateString()}
            </span>
          )}
          {filters.endDate && (
            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
              To: {new Date(filters.endDate).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default QuotationFiltersComponent; 