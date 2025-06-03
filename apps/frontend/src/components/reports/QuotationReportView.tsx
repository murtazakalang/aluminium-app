'use client';

import React, { useState, useEffect } from 'react';
import { FileText, TrendingUp, DollarSign, Target } from 'lucide-react';
import KPICard from '@/components/ui/KPICard';
import BarChart from '@/components/ui/BarChart';
import PieChart from '@/components/ui/PieChart';
import LineChart from '@/components/ui/LineChart';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { reportingApi, QuotationReportData, ReportFilters } from '@/lib/api/reportingService';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Table from '@/components/ui/Table';

interface QuotationReportViewProps {
  initialFilters?: ReportFilters;
}

export default function QuotationReportView({ initialFilters }: QuotationReportViewProps) {
  const [data, setData] = useState<QuotationReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>(initialFilters || {});

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await reportingApi.fetchQuotationReport(filters);
      if (response.success) {
        setData(response.data);
      } else {
        toast.error('Failed to load quotation report data');
      }
    } catch (error) {
      toast.error('Failed to load quotation report data');
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

  // Transform data for charts
  const statusChartData = data && data.statusBreakdown ? Object.entries(data.statusBreakdown).map(([status, summary]) => ({
    name: status,
    count: summary.count,
    value: summary.value,
  })) : [];

  const getQuotationTableColumns = () => {
    if (!data || !data.topQuotations || data.topQuotations.length === 0) return [];
    
    return [
      {
        header: 'Quotation ID',
        accessor: 'quotationIdDisplay' as const,
      },
      {
        header: 'Client',
        accessor: 'clientName' as const,
      },
      {
        header: 'Amount',
        accessor: ((item: Record<string, unknown>) => {
          const amount = Number(item.grandTotal) || 0;
          return `₹${(amount / 100000).toFixed(2)}L`;
        }),
      },
      {
        header: 'Status',
        accessor: ((item: Record<string, unknown>) => (
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            item.status === 'Approved' ? 'bg-green-100 text-green-800' :
            item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
            item.status === 'Rejected' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {String(item.status)}
          </span>
        )),
      },
      {
        header: 'Date',
        accessor: ((item: Record<string, unknown>) => 
          new Date(item.createdAt as string).toLocaleDateString()
        ),
      },
    ];
  };

  const getProductTableColumns = () => {
    if (!data || !data.productAnalysis || data.productAnalysis.length === 0) return [];
    
    return [
      {
        header: 'Product',
        accessor: 'productName' as const,
      },
      {
        header: 'Quotations',
        accessor: 'count' as const,
      },
      {
        header: 'Total Value',
        accessor: ((item: Record<string, unknown>) => {
          const value = Number(item.totalValue) || 0;
          return `₹${(value / 100000).toFixed(2)}L`;
        }),
      },
      {
        header: 'Avg. Value',
        accessor: ((item: Record<string, unknown>) => {
          const totalValue = Number(item.totalValue) || 0;
          const count = Number(item.count) || 1;
          return `₹${(totalValue / count / 100000).toFixed(2)}L`;
        }),
      },
    ];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading quotation report...</span>
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
            {data && data.statusBreakdown ? Object.keys(data.statusBreakdown).map(status => (
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
            )) : null}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Quotations"
          value={data?.summary?.totalQuotations || 0}
          icon={FileText}
          iconClassName="text-blue-600"
        />
        <KPICard
          title="Total Value"
          value={`₹${((data?.summary?.totalValue || 0) / 100000).toFixed(1)}L`}
          icon={DollarSign}
          iconClassName="text-green-600"
        />
        <KPICard
          title="Conversion Rate"
          value={`${(data?.summary?.conversionRate || 0).toFixed(1)}%`}
          icon={Target}
          iconClassName="text-orange-600"
        />
        <KPICard
          title="Avg. Quotation Value"
          value={`₹${((data?.summary?.averageQuotationValue || 0) / 100000).toFixed(1)}L`}
          icon={TrendingUp}
          iconClassName="text-purple-600"
        />
      </div>

      {/* Monthly Trends */}
      {data?.monthlyTrends && data.monthlyTrends.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <LineChart
            data={data.monthlyTrends}
            xAxisKey="month"
            yAxisKey={['totalValue', 'totalQuotations']}
            title="Monthly Quotation Trends"
            height={350}
            formatYAxis={(value) => typeof value === 'number' && value > 100000 ? `₹${(value / 100000).toFixed(1)}L` : value.toString()}
            formatTooltip={(value, name) => {
              if (name === 'totalValue') {
                return [`₹${(Number(value) / 100000).toFixed(2)}L`, 'Total Value'];
              }
              return [value.toString(), 'Total Quotations'];
            }}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <PieChart
            data={statusChartData}
            dataKey="count"
            nameKey="name"
            title="Quotation Status Distribution"
            height={300}
            formatTooltip={(value, name) => [`${value} quotations`, name]}
          />
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <BarChart
            data={statusChartData}
            xAxisKey="name"
            yAxisKey="value"
            title="Value by Status"
            height={300}
            formatYAxis={(value) => `₹${(Number(value) / 100000).toFixed(1)}L`}
            formatTooltip={(value, name) => [`₹${(Number(value) / 100000).toFixed(2)}L`, name]}
          />
        </div>
      </div>

      {/* Product Analysis */}
      {data.productAnalysis && data.productAnalysis.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <BarChart
            data={data.productAnalysis.slice(0, 10)} // Top 10 products
            xAxisKey="productName"
            yAxisKey="totalValue"
            title="Top Products by Quotation Value"
            height={300}
            formatYAxis={(value) => `₹${(Number(value) / 100000).toFixed(1)}L`}
            formatTooltip={(value, name) => [`₹${(Number(value) / 100000).toFixed(2)}L`, name]}
            formatXAxis={(value) => String(value).length > 15 ? String(value).substring(0, 15) + '...' : String(value)}
          />
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Quotations */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent High-Value Quotations</h3>
            <p className="text-sm text-gray-500">Latest quotations sorted by value</p>
          </div>
          <div className="p-6">
            <Table
              columns={getQuotationTableColumns()}
              data={data.topQuotations}
              keyExtractor={(item) => item._id}
              emptyStateMessage="No quotation data available"
            />
          </div>
        </div>

        {/* Product Analysis */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Product Performance</h3>
            <p className="text-sm text-gray-500">Products ranked by quotation value</p>
          </div>
          <div className="p-6">
            <Table
              columns={getProductTableColumns()}
              data={data.productAnalysis}
              keyExtractor={(item) => item._id}
              emptyStateMessage="No product data available"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 