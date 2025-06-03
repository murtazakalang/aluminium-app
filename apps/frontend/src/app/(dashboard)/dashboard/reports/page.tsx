'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Users, 
  FileText, 
  ShoppingCart, 
  Package, 
  Settings,
  BarChart3,
  Download
} from 'lucide-react';
import KPICard from '@/components/ui/KPICard';
import BarChart from '@/components/ui/BarChart';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { reportingApi, DashboardOverviewData } from '@/lib/api/reportingService';
import { toast } from 'sonner';

const reportCards = [
  {
    title: 'Client Reports',
    description: 'Analyze client performance, conversion rates, and lead sources',
    href: '/dashboard/reports/clients',
    icon: Users,
    color: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-600',
  },
  {
    title: 'Quotation Reports',
    description: 'Track quotation trends, success rates, and product analysis',
    href: '/dashboard/reports/quotations',
    icon: FileText,
    color: 'bg-green-50 border-green-200',
    iconColor: 'text-green-600',
  },
  {
    title: 'Sales Order Reports',
    description: 'Monitor order completion, production status, and sales trends',
    href: '/dashboard/reports/sales-orders',
    icon: ShoppingCart,
    color: 'bg-orange-50 border-orange-200',
    iconColor: 'text-orange-600',
  },
  {
    title: 'Inventory Reports',
    description: 'View stock levels, category breakdowns, and low stock alerts',
    href: '/dashboard/reports/inventory',
    icon: Package,
    color: 'bg-purple-50 border-purple-200',
    iconColor: 'text-purple-600',
  },
  {
    title: 'Manufacturing Reports',
    description: 'Analyze cutting efficiency, material utilization, and scrap rates',
    href: '/dashboard/reports/manufacturing',
    icon: Settings,
    color: 'bg-indigo-50 border-indigo-200',
    iconColor: 'text-indigo-600',
  },
];

export default function ReportsPage() {
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const filters: Record<string, string> = {};
      
      if (startDate) filters.startDate = startDate.toISOString().split('T')[0];
      if (endDate) filters.endDate = endDate.toISOString().split('T')[0];

      const response = await reportingApi.fetchDashboardOverview(filters);
      if (response.success) {
        setData(response.data);
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateChange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const exportData = () => {
    // TODO: Implement export functionality
    toast.info('Export functionality coming soon');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Comprehensive analytics and insights across all business modules
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
            className="w-64"
          />
          <button
            onClick={exportData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Total Clients"
            value={data.clients.total}
            subtitle={`${data.clients.conversionRate.toFixed(1)}% conversion rate`}
            icon={Users}
            iconClassName="text-blue-600"
          />
          <KPICard
            title="Quotation Value"
            value={`₹${(data.quotations.totalValue / 100000).toFixed(1)}L`}
            subtitle={`${data.quotations.total} quotations`}
            icon={FileText}
            iconClassName="text-green-600"
          />
          <KPICard
            title="Order Value"
            value={`₹${(data.orders.totalValue / 100000).toFixed(1)}L`}
            subtitle={`${data.orders.inProduction} in production`}
            icon={ShoppingCart}
            iconClassName="text-orange-600"
          />
          <KPICard
            title="Inventory Value"
            value={`₹${(data.inventory.totalValue / 100000).toFixed(1)}L`}
            subtitle={`${data.inventory.lowStockItems} low stock items`}
            icon={Package}
            iconClassName="text-purple-600"
          />
        </div>
      )}

      {/* Quick Charts */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <BarChart
              data={data.quotations.recentTrend.map(item => ({
                month: item.month,
                value: item.totalValue / 100000, // Convert to lakhs
              }))}
              xAxisKey="month"
              yAxisKey="value"
              title="Quotation Trends (Last 6 Months)"
              height={250}
              formatYAxis={(value) => `₹${value}L`}
            />
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <BarChart
              data={data.manufacturing.topMaterials.map(item => ({
                material: item.materialName.length > 15 
                  ? item.materialName.substring(0, 15) + '...' 
                  : item.materialName,
                efficiency: item.averageEfficiencyPercentage,
              }))}
              xAxisKey="material"
              yAxisKey="efficiency"
              title="Top Material Efficiency"
              height={250}
              formatYAxis={(value) => `${value}%`}
              colors={['#10B981']}
            />
          </div>
        </div>
      )}

      {/* Report Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportCards.map((report) => {
            const Icon = report.icon;
            return (
              <Link
                key={report.href}
                href={report.href}
                className={`block p-6 rounded-lg border-2 transition-all hover:shadow-md hover:scale-105 ${report.color}`}
              >
                <div className="flex items-center">
                  <Icon className={`h-8 w-8 ${report.iconColor}`} />
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {report.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {report.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  View detailed analytics
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading dashboard data...</span>
        </div>
      )}
    </div>
  );
} 