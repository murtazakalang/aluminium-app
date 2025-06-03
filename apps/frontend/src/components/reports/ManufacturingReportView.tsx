'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Wrench, Target, Activity } from 'lucide-react';
import KPICard from '@/components/ui/KPICard';
import BarChart from '@/components/ui/BarChart';
import PieChart from '@/components/ui/PieChart';
import LineChart from '@/components/ui/LineChart';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { reportingApi, ManufacturingReportData, ReportFilters } from '@/lib/api/reportingService';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Table from '@/components/ui/Table';

interface ManufacturingReportViewProps {
  initialFilters?: ReportFilters;
}

export default function ManufacturingReportView({ initialFilters }: ManufacturingReportViewProps) {
  const [data, setData] = useState<ManufacturingReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>(initialFilters || {});

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await reportingApi.fetchManufacturingReport(filters);
      if (response.success) {
        setData(response.data);
      } else {
        toast.error('Failed to load manufacturing report data');
      }
    } catch (error) {
      toast.error('Failed to load manufacturing report data');
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

  const handleMaterialFilter = (materialId: string) => {
    setFilters(prev => ({
      ...prev,
      materialId: prev.materialId === materialId ? undefined : materialId,
    }));
  };

  // Transform data for charts
  const materialEfficiencyData = data?.materialPerformance || [];
  const monthlyTrendsData = data?.monthlyTrends || [];

  const getMaterialPerformanceTableColumns = () => {
    if (!data || !data.materialPerformance || data.materialPerformance.length === 0) return [];
    
    return [
      {
        header: 'Material',
        accessor: 'materialName' as const,
      },
      {
        header: 'Total Plans',
        accessor: 'totalPlans' as const,
      },
      {
        header: 'Pipes Used',
        accessor: 'totalPipesUsed' as const,
      },
      {
        header: 'Efficiency',
        accessor: ((item: Record<string, unknown>) => {
          const efficiency = Number(item.averageEfficiencyPercentage) || 0;
          return (
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              efficiency >= 90 ? 'bg-green-100 text-green-800' :
              efficiency >= 75 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {efficiency.toFixed(1)}%
            </span>
          );
        }),
      },
      {
        header: 'Scrap %',
        accessor: ((item: Record<string, unknown>) => {
          const scrap = Number(item.averageScrapPercentage) || 0;
          return `${scrap.toFixed(1)}%`;
        }),
      },
      {
        header: 'Total Scrap',
        accessor: ((item: Record<string, unknown>) => {
          const scrap = Number(item.totalScrapLength) || 0;
          const unit = item.scrapUnit as string || 'm';
          return `${scrap.toFixed(2)} ${unit}`;
        }),
      },
    ];
  };

  const getLengthUtilizationTableColumns = () => {
    if (!data || !data.lengthUtilization || data.lengthUtilization.length === 0) return [];
    
    return [
      {
        header: 'Standard Length',
        accessor: ((item: Record<string, unknown>) => {
          const length = Number(item.standardLength) || 0;
          const unit = item.unit as string || 'm';
          return `${length} ${unit}`;
        }),
      },
      {
        header: 'Total Used',
        accessor: 'totalUsed' as const,
      },
      {
        header: 'Total Scrap',
        accessor: 'totalScrap' as const,
      },
      {
        header: 'Efficiency',
        accessor: ((item: Record<string, unknown>) => {
          const efficiency = Number(item.efficiencyPercentage) || 0;
          return (
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              efficiency >= 90 ? 'bg-green-100 text-green-800' :
              efficiency >= 75 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {efficiency.toFixed(1)}%
            </span>
          );
        }),
      },
    ];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading manufacturing report...</span>
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
            {data?.materialPerformance?.slice(0, 5).map(material => (
              <button
                key={material._id}
                onClick={() => handleMaterialFilter(material._id)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filters.materialId === material._id
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {material.materialName}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Overall Efficiency"
          value={`${(data?.summary?.overallEfficiencyPercentage || 0).toFixed(1)}%`}
          icon={Target}
          iconClassName="text-green-600"
        />
        <KPICard
          title="Total Plans"
          value={data?.summary?.totalPlans || 0}
          icon={Activity}
          iconClassName="text-blue-600"
        />
        <KPICard
          title="Average Scrap"
          value={`${(data?.summary?.averageScrapPercentage || 0).toFixed(1)}%`}
          icon={Wrench}
          iconClassName="text-red-600"
        />
        <KPICard
          title="Pipes Used"
          value={data?.summary?.totalPipesUsed || 0}
          icon={Zap}
          iconClassName="text-purple-600"
        />
      </div>

      {/* Monthly Trends */}
      {monthlyTrendsData.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <LineChart
            data={monthlyTrendsData}
            xAxisKey="month"
            yAxisKey={['averageEfficiency', 'averageScrap']}
            title="Monthly Manufacturing Trends"
            height={350}
            formatYAxis={(value) => `${Number(value).toFixed(1)}%`}
            formatTooltip={(value, name) => {
              if (name === 'averageEfficiency') {
                return [`${Number(value).toFixed(1)}%`, 'Avg. Efficiency'];
              }
              return [`${Number(value).toFixed(1)}%`, 'Avg. Scrap'];
            }}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <PieChart
            data={materialEfficiencyData.slice(0, 8)} // Top 8 materials
            dataKey="totalPlans"
            nameKey="materialName"
            title="Plans Distribution by Material"
            height={300}
            formatTooltip={(value, name) => [`${value} plans`, name]}
          />
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <BarChart
            data={materialEfficiencyData.slice(0, 10)} // Top 10 materials
            xAxisKey="materialName"
            yAxisKey="averageEfficiencyPercentage"
            title="Material Efficiency Performance"
            height={300}
            formatYAxis={(value) => `${Number(value).toFixed(1)}%`}
            formatTooltip={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            formatXAxis={(value) => value.toString().length > 15 ? value.toString().substring(0, 15) + '...' : value.toString()}
          />
        </div>
      </div>

      {/* Material Scrap Analysis */}
      {materialEfficiencyData.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <BarChart
            data={materialEfficiencyData.slice(0, 10)} // Top 10 materials
            xAxisKey="materialName"
            yAxisKey="averageScrapPercentage"
            title="Material Scrap Analysis"
            height={300}
            formatYAxis={(value) => `${Number(value).toFixed(1)}%`}
            formatTooltip={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            formatXAxis={(value) => value.toString().length > 15 ? value.toString().substring(0, 15) + '...' : value.toString()}
          />
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6">
        {/* Material Performance */}
        {data.materialPerformance && data.materialPerformance.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Material Performance Summary</h3>
              <p className="text-sm text-gray-500">Performance metrics by material type</p>
            </div>
            <div className="p-6">
              <Table
                columns={getMaterialPerformanceTableColumns()}
                data={data.materialPerformance}
                keyExtractor={(item) => item._id}
                emptyStateMessage="No material performance data available"
              />
            </div>
          </div>
        )}

        {/* Length Utilization */}
        {data.lengthUtilization && data.lengthUtilization.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Length Utilization Analysis</h3>
              <p className="text-sm text-gray-500">Efficiency by standard pipe lengths</p>
            </div>
            <div className="p-6">
              <Table
                columns={getLengthUtilizationTableColumns()}
                data={data.lengthUtilization}
                keyExtractor={(item) => item._id.toString()}
                emptyStateMessage="No length utilization data available"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 