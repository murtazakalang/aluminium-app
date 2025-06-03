'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, TrendingDown, BarChart3 } from 'lucide-react';
import KPICard from '@/components/ui/KPICard';
import BarChart from '@/components/ui/BarChart';
import PieChart from '@/components/ui/PieChart';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { reportingApi, InventoryReportData, ReportFilters } from '@/lib/api/reportingService';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Table from '@/components/ui/Table';

interface InventoryReportViewProps {
  initialFilters?: ReportFilters;
}

export default function InventoryReportView({ initialFilters }: InventoryReportViewProps) {
  const [data, setData] = useState<InventoryReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>(initialFilters || {});

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await reportingApi.fetchInventoryReport(filters);
      if (response.success) {
        setData(response.data);
      } else {
        toast.error('Failed to load inventory report data');
      }
    } catch (error) {
      toast.error('Failed to load inventory report data');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateChange = (startDate: Date | null, endDate: Date | null) => {
    setFilters(prev => ({
      ...prev,
      startDate: startDate?.toISOString().split('T')[0],
      endDate: endDate?.toISOString().split('T')[0],
    }));
  };

  const handleCategoryFilter = (category: string) => {
    setFilters(prev => ({
      ...prev,
      category: prev.category === category ? undefined : category,
    }));
  };

  const handleLowStockFilter = () => {
    setFilters(prev => ({
      ...prev,
      lowStockOnly: !prev.lowStockOnly,
    }));
  };

  // Transform data for charts
  const categoryChartData = data && data.summary.categoryTotals ? Object.entries(data.summary.categoryTotals).map(([category, summary]) => ({
    name: category,
    count: summary.count,
    value: summary.value,
  })) : [];

  const getProfileTableColumns = () => {
    if (!data || !data.profileDetails || data.profileDetails.length === 0) return [];
    
    return [
      {
        header: 'Material',
        accessor: ((item: Record<string, unknown>) => {
          const materialData = item._id as Record<string, unknown>;
          return `${materialData?.materialName || 'N/A'}`;
        }),
      },
      {
        header: 'Length & Unit',
        accessor: ((item: Record<string, unknown>) => {
          const materialData = item._id as Record<string, unknown>;
          return `${materialData?.length || 0} ${materialData?.unit || ''}`;
        }),
      },
      {
        header: 'Quantity',
        accessor: ((item: Record<string, unknown>) => {
          const qty = Number(item.quantity) || 0;
          return qty.toLocaleString();
        }),
      },
      {
        header: 'Stock Value',
        accessor: ((item: Record<string, unknown>) => {
          const value = Number(item.stockValue) || 0;
          return `₹${(value / 100000).toFixed(2)}L`;
        }),
      },
      {
        header: 'Status',
        accessor: ((item: Record<string, unknown>) => (
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            item.isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {item.isLowStock ? 'Low Stock' : 'In Stock'}
          </span>
        )),
      },
    ];
  };

  const getNonProfileTableColumns = () => {
    if (!data || !data.nonProfileDetails || data.nonProfileDetails.length === 0) return [];
    
    return [
      {
        header: 'Material',
        accessor: 'materialName' as const,
      },
      {
        header: 'Category',
        accessor: 'category' as const,
      },
      {
        header: 'Stock Quantity',
        accessor: ((item: Record<string, unknown>) => {
          const qty = Number(item.totalStockQuantity) || 0;
          return `${qty.toLocaleString()} ${item.stockUnit || ''}`;
        }),
      },
      {
        header: 'Stock Value',
        accessor: ((item: Record<string, unknown>) => {
          const value = Number(item.stockValue) || 0;
          return `₹${(value / 100000).toFixed(2)}L`;
        }),
      },
      {
        header: 'Status',
        accessor: ((item: Record<string, unknown>) => (
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            item.isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {item.isLowStock ? 'Low Stock' : 'In Stock'}
          </span>
        )),
      },
    ];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading inventory report...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <DateRangePicker
            startDate={filters.startDate ? new Date(filters.startDate) : null}
            endDate={filters.endDate ? new Date(filters.endDate) : null}
            onDateChange={handleDateChange}
            className="w-64"
          />
          
          <div className="flex flex-wrap gap-2">
            {data && data.summary.categoryTotals ? Object.keys(data.summary.categoryTotals).map(category => (
              <button
                key={category}
                onClick={() => handleCategoryFilter(category)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filters.category === category
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            )) : null}
          </div>

          <button
            onClick={handleLowStockFilter}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filters.lowStockOnly
                ? 'bg-red-100 border-red-300 text-red-800'
                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Low Stock Only
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Materials"
          value={data?.summary?.totalMaterials || 0}
          icon={Package}
          iconClassName="text-blue-600"
        />
        <KPICard
          title="Total Stock Value"
          value={`₹${((data?.summary?.totalStockValue || 0) / 100000).toFixed(1)}L`}
          icon={BarChart3}
          iconClassName="text-green-600"
        />
        <KPICard
          title="Low Stock Items"
          value={data?.summary?.lowStockItems || 0}
          icon={AlertTriangle}
          iconClassName="text-red-600"
        />
        <KPICard
          title="Categories"
          value={Object.keys(data?.summary?.categoryTotals || {}).length}
          icon={TrendingDown}
          iconClassName="text-purple-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <PieChart
            data={categoryChartData}
            dataKey="count"
            nameKey="name"
            title="Materials by Category"
            height={300}
            formatTooltip={(value, name) => [`${value} materials`, name]}
          />
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <BarChart
            data={categoryChartData}
            xAxisKey="name"
            yAxisKey="value"
            title="Stock Value by Category"
            height={300}
            formatYAxis={(value) => `₹${(Number(value) / 100000).toFixed(1)}L`}
            formatTooltip={(value, name) => [`₹${(Number(value) / 100000).toFixed(2)}L`, name]}
          />
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6">
        {/* Profile Materials */}
        {data.profileDetails && data.profileDetails.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Profile Materials</h3>
              <p className="text-sm text-gray-500">Aluminum profiles with length specifications</p>
            </div>
            <div className="p-6">
              <Table
                columns={getProfileTableColumns()}
                data={data.profileDetails}
                keyExtractor={(item) => `${(item._id as Record<string, unknown>)?.materialName}-${(item._id as Record<string, unknown>)?.length}`}
                emptyStateMessage="No profile materials data available"
              />
            </div>
          </div>
        )}

        {/* Non-Profile Materials */}
        {data.nonProfileDetails && data.nonProfileDetails.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Non-Profile Materials</h3>
              <p className="text-sm text-gray-500">Glass, accessories, and other materials</p>
            </div>
            <div className="p-6">
              <Table
                columns={getNonProfileTableColumns()}
                data={data.nonProfileDetails}
                keyExtractor={(item) => item._id as string}
                emptyStateMessage="No non-profile materials data available"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 