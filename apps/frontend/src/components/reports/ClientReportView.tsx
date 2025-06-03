'use client';

import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Target, Award } from 'lucide-react';
import KPICard from '@/components/ui/KPICard';
import BarChart from '@/components/ui/BarChart';
import PieChart from '@/components/ui/PieChart';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { reportingApi, ClientReportData, ReportFilters } from '@/lib/api/reportingService';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Table from '@/components/ui/Table';

interface ClientReportViewProps {
  initialFilters?: ReportFilters;
}

export default function ClientReportView({ initialFilters }: ClientReportViewProps) {
  const [data, setData] = useState<ClientReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>(initialFilters || {});

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await reportingApi.fetchClientReport(filters);
      if (response.success) {
        setData(response.data);
      } else {
        toast.error('Failed to load client report data');
      }
    } catch (error) {
      toast.error('Failed to load client report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const handleDateChange = (startDate: Date | null, endDate: Date | null) => {
    setFilters(prev => ({
      ...prev,
      startDate: startDate?.toISOString().split('T')[0],
      endDate: endDate?.toISOString().split('T')[0],
    }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status === status ? undefined : status,
    }));
  };

  const handleLeadSourceFilter = (leadSource: string) => {
    setFilters(prev => ({
      ...prev,
      leadSource: prev.leadSource === leadSource ? undefined : leadSource,
    }));
  };

  // Transform data for charts
  const statusChartData = data ? Object.entries(data.statusSummary).map(([status, summary]) => ({
    name: status,
    count: summary.count,
    value: summary.value,
  })) : [];

  const leadSourceChartData = data ? Object.entries(data.leadSourceSummary).map(([source, summary]) => ({
    name: source,
    count: summary.count,
    value: summary.value,
  })) : [];

  // Define table columns conditionally to avoid null reference errors
  const getTableColumns = () => {
    if (!data || !data.topClients || data.topClients.length === 0) return [];
    
    return [
      {
        header: 'Client Name',
        accessor: 'clientName' as const,
      },
      {
        header: 'Quotation Value',
        accessor: ((item: Record<string, unknown>) => {
          const value = Number(item.quotationValue) || 0;
          return `₹${(value / 100000).toFixed(2)}L`;
        }),
      },
      {
        header: 'Order Value',
        accessor: ((item: Record<string, unknown>) => {
          const value = Number(item.orderValue) || 0;
          return `₹${(value / 100000).toFixed(2)}L`;
        }),
      },
      {
        header: 'Conversion Rate',
        accessor: ((item: Record<string, unknown>) => {
          const value = Number(item.conversionRate) || 0;
          return `${value.toFixed(1)}%`;
        }),
      },
    ];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading client report...</span>
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
            {Object.keys(data.statusSummary).map(status => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filters.status === status
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.keys(data.leadSourceSummary).map(source => (
              <button
                key={source}
                onClick={() => handleLeadSourceFilter(source)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filters.leadSource === source
                    ? 'bg-green-100 border-green-300 text-green-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {source}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Clients"
          value={data.totalClients}
          icon={Users}
          iconClassName="text-blue-600"
        />
        <KPICard
          title="Quotation Value"
          value={`₹${(data.totalQuotationValue / 100000).toFixed(1)}L`}
          icon={Target}
          iconClassName="text-green-600"
        />
        <KPICard
          title="Order Value"
          value={`₹${(data.totalOrderValue / 100000).toFixed(1)}L`}
          icon={Award}
          iconClassName="text-orange-600"
        />
        <KPICard
          title="Conversion Rate"
          value={`${data.overallConversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          iconClassName="text-purple-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <PieChart
            data={statusChartData}
            dataKey="count"
            nameKey="name"
            title="Client Status Distribution"
            height={300}
            formatTooltip={(value, name) => [`${value} clients`, name]}
          />
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <PieChart
            data={leadSourceChartData}
            dataKey="count"
            nameKey="name"
            title="Lead Source Distribution"
            height={300}
            formatTooltip={(value, name) => [`${value} clients`, name]}
          />
        </div>
      </div>

      {/* Value Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <BarChart
            data={statusChartData}
            xAxisKey="name"
            yAxisKey="value"
            title="Quotation Value by Status"
            height={300}
            formatYAxis={(value) => `₹${(value / 100000).toFixed(1)}L`}
            formatTooltip={(value, name) => [`₹${(value / 100000).toFixed(2)}L`, name]}
          />
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <BarChart
            data={leadSourceChartData}
            xAxisKey="name"
            yAxisKey="value"
            title="Quotation Value by Lead Source"
            height={300}
            formatYAxis={(value) => `₹${(value / 100000).toFixed(1)}L`}
            formatTooltip={(value, name) => [`₹${(value / 100000).toFixed(2)}L`, name]}
          />
        </div>
      </div>

      {/* Top Clients Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Top Performing Clients</h3>
          <p className="text-sm text-gray-500">Clients ranked by conversion rate and order value</p>
        </div>
        <div className="p-6">
          <Table
            columns={getTableColumns()}
            data={data.topClients}
            keyExtractor={(item) => item._id}
            emptyStateMessage="No client data available"
          />
        </div>
      </div>
    </div>
  );
} 