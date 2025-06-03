'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  History, Package, Calendar, User, FileText, 
  ExternalLink, Filter, Download, Search,
  Clock, Scissors, AlertCircle
} from 'lucide-react';
import { 
  batchInventoryApi, 
  ConsumptionHistoryEntry, 
  ConsumptionHistoryFilters 
} from '@/lib/api/batchInventoryService';
import { toast } from 'sonner';

interface ConsumptionHistoryViewerProps {
  materialId: string;
  materialName: string;
}

const ConsumptionHistoryViewer: React.FC<ConsumptionHistoryViewerProps> = ({
  materialId,
  materialName
}) => {
  const [consumptionHistory, setConsumptionHistory] = useState<ConsumptionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    total: 1,
    count: 0,
    totalRecords: 0
  });
  
  const [filters, setFilters] = useState<ConsumptionHistoryFilters>({
    page: 1,
    limit: 20
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadConsumptionHistory();
  }, [materialId, filters]);

  const loadConsumptionHistory = async () => {
    try {
      setLoading(true);
      const response = await batchInventoryApi.getConsumptionHistory(materialId, filters);
      setConsumptionHistory(response.data);
      setPagination(response.pagination);
    } catch (error) {
      toast.error('Failed to load consumption history');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<ConsumptionHistoryFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'Outward-OrderCut':
        return 'bg-orange-100 text-orange-800';
      case 'Outward-Manual':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrderStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'In Production': 'bg-blue-100 text-blue-800',
      'Cutting': 'bg-yellow-100 text-yellow-800',
      'Ready for Installation': 'bg-green-100 text-green-800',
      'Completed': 'bg-gray-100 text-gray-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-orange-600" />
          <div>
            <h2 className="text-xl font-semibold">Consumption History</h2>
            <p className="text-sm text-gray-600">{materialName}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          
          <Button
            onClick={() => {
              // TODO: Implement export functionality
              toast.info('Export functionality coming soon');
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange({ startDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange({ endDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order ID
              </label>
              <input
                type="text"
                placeholder="Search by order ID..."
                value={filters.orderId || ''}
                onChange={(e) => handleFilterChange({ orderId: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              onClick={() => setFilters({ page: 1, limit: 20 })}
              variant="outline"
              size="sm"
            >
              Clear Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Total Records</span>
          </div>
          <div className="text-xl font-bold">{pagination.totalRecords}</div>
          <div className="text-xs text-gray-500">consumption entries</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Scissors className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-600">Total Consumed</span>
          </div>
          <div className="text-xl font-bold">
            {consumptionHistory.reduce((sum, entry) => sum + entry.quantityConsumed, 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">pieces total</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-gray-600">Total Value</span>
          </div>
          <div className="text-xl font-bold">
            {formatCurrency(consumptionHistory.reduce((sum, entry) => sum + entry.totalValue, 0))}
          </div>
          <div className="text-xs text-gray-500">material cost</div>
        </Card>
      </div>

      {/* Consumption History Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Transaction
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Consumption
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Consumed By
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 animate-spin" />
                      Loading consumption history...
                    </div>
                  </td>
                </tr>
              ) : consumptionHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-gray-400" />
                      <p>No consumption history found for this material.</p>
                      <p className="text-sm text-gray-400">
                        Consumption records will appear here when materials are used in orders.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                consumptionHistory.map((entry) => (
                  <tr key={entry.transactionId} className="hover:bg-gray-50">
                    
                    {/* Date & Transaction */}
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">
                            {formatDate(entry.transactionDate)}
                          </span>
                        </div>
                        <Badge className={getTransactionTypeColor(entry.type)}>
                          {entry.type === 'Outward-OrderCut' ? 'Order Production' : 'Manual Consumption'}
                        </Badge>
                        {entry.notes && (
                          <p className="text-xs text-gray-500 italic">{entry.notes}</p>
                        )}
                      </div>
                    </td>

                    {/* Order Details */}
                    <td className="px-4 py-4">
                      {entry.orderDetails ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">
                              {entry.orderDetails.orderIdDisplay}
                            </span>
                            <ExternalLink className="h-3 w-3 text-blue-400" />
                          </div>
                          <div className="text-sm text-gray-600">
                            {entry.orderDetails.clientName}
                          </div>
                          <Badge className={getOrderStatusColor(entry.orderDetails.orderStatus)}>
                            {entry.orderDetails.orderStatus}
                          </Badge>
                          {entry.cuttingPlanDetails && (
                            <div className="text-xs text-gray-500">
                              Cutting Plan: {entry.cuttingPlanDetails.status}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          Manual consumption
                        </div>
                      )}
                    </td>

                    {/* Consumption */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {entry.quantityConsumed.toLocaleString()} {entry.quantityUnit}
                        </div>
                        {entry.length && entry.lengthUnit && (
                          <div className="text-xs text-gray-500">
                            Length: {entry.length} {entry.lengthUnit}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Cost Details */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {formatCurrency(entry.totalValue)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Rate: ₹{parseFloat(entry.unitRate).toFixed(2)}/piece
                        </div>
                      </div>
                    </td>

                    {/* Consumed By */}
                    <td className="px-4 py-4">
                      {entry.consumedBy ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium">
                              {entry.consumedBy.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {entry.consumedBy.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">System</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > 1 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((pagination.current - 1) * (filters.limit || 20)) + 1} to {Math.min(pagination.current * (filters.limit || 20), pagination.totalRecords)} of {pagination.totalRecords} results
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => handlePageChange(pagination.current - 1)}
                  disabled={pagination.current <= 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                
                <span className="flex items-center px-3 py-1 text-sm">
                  Page {pagination.current} of {pagination.total}
                </span>
                
                <Button
                  onClick={() => handlePageChange(pagination.current + 1)}
                  disabled={pagination.current >= pagination.total}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ConsumptionHistoryViewer; 