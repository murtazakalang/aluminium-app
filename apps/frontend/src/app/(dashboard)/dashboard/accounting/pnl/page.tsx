'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { accountingApi, PnLSimpleResponse, PnLFilters } from '@/lib/api/accountingService';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Calendar, Download } from 'lucide-react';

export default function PnLPage() {
  const [pnlData, setPnlData] = useState<PnLSimpleResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PnLFilters>({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  });

  useEffect(() => {
    loadPnLData();
  }, [filters]);

  const loadPnLData = async () => {
    try {
      setLoading(true);
      const response = await accountingApi.getPnLSimple(filters);
      setPnlData(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load P&L data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const exportToCSV = () => {
    if (!pnlData) return;

    const csvContent = [
      ['Profit & Loss Statement'],
      [`Period: ${pnlData.period?.startDate ? formatDate(pnlData.period.startDate) : 'N/A'} to ${pnlData.period?.endDate ? formatDate(pnlData.period.endDate) : 'N/A'}`],
      [''],
      ['REVENUE'],
      ...(pnlData.revenue?.entries || []).map(entry => [entry.category, formatCurrency(entry.amount), entry.percentage ? formatPercentage(entry.percentage) : '']),
      ['Total Revenue', formatCurrency(pnlData.revenue?.totalInvoiced || 0), '100.0%'],
      [''],
      ['COSTS'],
      ...(pnlData.costs?.entries || []).map(entry => [entry.category, formatCurrency(entry.amount), entry.percentage ? formatPercentage(entry.percentage) : '']),
      ['Total Costs', formatCurrency(pnlData.costs?.totalCosts || 0), '100.0%'],
      [''],
      ['SUMMARY'],
      ['Gross Profit', formatCurrency(pnlData.summary?.grossProfit || 0), formatPercentage(pnlData.summary?.grossMargin || 0)],
      ['Net Profit', formatCurrency(pnlData.summary?.netProfit || 0), formatPercentage(pnlData.summary?.netMargin || 0)]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pnl-report-${filters.startDate}-to-${filters.endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !pnlData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Failed to load P&L data'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profit & Loss</h1>
          <p className="text-gray-500 mt-1">
            {pnlData.period?.startDate ? formatDate(pnlData.period.startDate) : 'N/A'} to {pnlData.period?.endDate ? formatDate(pnlData.period.endDate) : 'N/A'}
          </p>
        </div>
        <Button 
          onClick={exportToCSV}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Date Range Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <Input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => setFilters({
                startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
              })}
              variant="outline"
              className="w-full"
            >
              Last 90 Days
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(pnlData.revenue?.totalInvoiced || 0)}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Costs</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(pnlData.costs?.totalCosts || 0)}
              </p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Gross Profit</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(pnlData.summary?.grossProfit || 0)}
              </p>
              <p className="text-sm text-gray-500">
                {formatPercentage(pnlData.summary?.grossMargin || 0)} margin
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Profit</p>
              <p className={`text-2xl font-bold ${
                (pnlData.summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(pnlData.summary?.netProfit || 0)}
              </p>
              <p className="text-sm text-gray-500">
                {formatPercentage(pnlData.summary?.netMargin || 0)} margin
              </p>
            </div>
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              (pnlData.summary?.netProfit || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <BarChart3 className={`h-6 w-6 ${
                (pnlData.summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Revenue Breakdown
          </h3>
          <div className="space-y-3">
            {(pnlData.revenue?.entries || []).map((entry, index) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{entry.category}</div>
                  {entry.subcategory && (
                    <div className="text-sm text-gray-500">{entry.subcategory}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {formatCurrency(entry.amount)}
                  </div>
                  {entry.percentage && (
                    <div className="text-sm text-gray-500">
                      {formatPercentage(entry.percentage)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between items-center font-bold">
              <span>Total Revenue</span>
              <span className="text-green-600">{formatCurrency(pnlData.revenue?.totalInvoiced || 0)}</span>
            </div>
          </div>
        </Card>

        {/* Cost Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            Cost Breakdown
          </h3>
          <div className="space-y-3">
            {(pnlData.costs?.entries || []).length === 0 ? (
              <p className="text-gray-500 text-sm">No cost data available for this period.</p>
            ) : (
              (pnlData.costs?.entries || []).map((entry, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">{entry.category}</div>
                    {entry.subcategory && (
                      <div className="text-sm text-gray-500">{entry.subcategory}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(entry.amount)}
                    </div>
                    {entry.percentage && (
                      <div className="text-sm text-gray-500">
                        {formatPercentage(entry.percentage)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div className="border-t pt-3 flex justify-between items-center font-bold">
              <span>Total Costs</span>
              <span className="text-red-600">{formatCurrency(pnlData.costs?.totalCosts || 0)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Profit Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Profit Analysis
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b">
              <span className="font-medium text-gray-700">Total Revenue</span>
              <span className="font-bold text-blue-600">
                {formatCurrency(pnlData.revenue?.totalInvoiced || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b">
              <span className="font-medium text-gray-700">Less: Total Costs</span>
              <span className="font-bold text-red-600">
                -{formatCurrency(pnlData.costs?.totalCosts || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-300">
              <span className="font-bold text-gray-900">Gross Profit</span>
              <span className={`font-bold ${
                (pnlData.summary?.grossProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(pnlData.summary?.grossProfit || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-300">
              <span className="font-bold text-gray-900">Net Profit</span>
              <span className={`font-bold ${
                (pnlData.summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(pnlData.summary?.netProfit || 0)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Key Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Gross Margin:</span>
                  <span className="font-medium">{formatPercentage(pnlData.summary?.grossMargin || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Margin:</span>
                  <span className="font-medium">{formatPercentage(pnlData.summary?.netMargin || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost Ratio:</span>
                  <span className="font-medium">
                    {formatPercentage(((pnlData.costs?.totalCosts || 0) / (pnlData.revenue?.totalInvoiced || 1)) * 100)}
                  </span>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              (pnlData.summary?.netProfit || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <h4 className={`font-medium mb-2 ${
                (pnlData.summary?.netProfit || 0) >= 0 ? 'text-green-900' : 'text-red-900'
              }`}>
                Performance Status
              </h4>
              <p className={`text-sm ${
                (pnlData.summary?.netProfit || 0) >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {(pnlData.summary?.netProfit || 0) >= 0
                  ? `Your business is profitable with a net margin of ${formatPercentage(pnlData.summary?.netMargin || 0)}.`
                  : `Your business shows a loss. Consider reviewing costs and pricing strategies.`
                }
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
} 