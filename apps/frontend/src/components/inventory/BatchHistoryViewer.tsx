'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormInput } from '@/components/ui/FormInput';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  History, Filter, Download, Eye, Calendar, Package, 
  TrendingUp, Truck, FileText, BarChart3 
} from 'lucide-react';
import { batchInventoryApi, StockBatch, BatchFilters } from '@/lib/api/batchInventoryService';
import { toast } from 'sonner';

interface BatchHistoryViewerProps {
  materialId: string;
  materialName: string;
  materialCategory?: string;
  onBatchSelect?: (batch: StockBatch) => void;
}

const BatchHistoryViewer: React.FC<BatchHistoryViewerProps> = ({
  materialId,
  materialName,
  materialCategory,
  onBatchSelect
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BatchFilters>({
    includeCompleted: true
  });

  const [analytics, setAnalytics] = useState({
    totalBatches: 0,
    activeBatches: 0,
    completedBatches: 0,
    totalValue: 0,
    totalWeight: 0,
    totalQuantity: 0,
    averageRate: 0,
    uniqueSuppliers: 0
  });

  // ============================================================================
  // MATERIAL TYPE DETECTION
  // ============================================================================
  
  // Detect material type from category prop or batch fields
  const isWireMesh = materialCategory === 'Wire Mesh' || 
    (batches.length > 0 && batches[0].selectedWidth !== undefined);
  
  const isProfile = materialCategory === 'Profile' || 
    (batches.length > 0 && batches[0].length !== undefined && batches[0].gauge !== undefined);

  // ============================================================================
  // LOAD BATCH HISTORY
  // ============================================================================
  
  useEffect(() => {
    loadBatchHistory();
  }, [materialId, filters]);

  const loadBatchHistory = async () => {
    try {
      setLoading(true);
      const response = await batchInventoryApi.getBatchHistory(materialId, filters);
      setBatches(response.data);
      calculateAnalytics(response.data);
    } catch (error) {
      toast.error('Failed to load batch history');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ANALYTICS CALCULATION
  // ============================================================================
  
  const calculateAnalytics = (batchData: StockBatch[]) => {
    const analytics = {
      totalBatches: batchData.length,
      activeBatches: batchData.filter(b => b.isActive && !b.isCompleted).length,
      completedBatches: batchData.filter(b => b.isCompleted).length,
      totalValue: 0,
      totalWeight: 0,
      totalQuantity: 0,
      averageRate: 0,
      uniqueSuppliers: new Set(batchData.map(b => b.supplier).filter(Boolean)).size
    };

    batchData.forEach(batch => {
      if (isWireMesh) {
        // For Wire Mesh, use area-based calculations
        const area = parseFloat(batch.totalArea || '0') || parseFloat(batch.currentQuantity) || 0;
        const cost = parseFloat(batch.totalCostPaid) || 0;
        
        if (!isNaN(area)) analytics.totalQuantity += area;
        if (!isNaN(cost)) analytics.totalValue += cost;
      } else {
        // For other materials, use quantity-based calculations
        const quantity = parseFloat(batch.originalQuantity) || 0;
        const cost = parseFloat(batch.totalCostPaid) || 0;
        const weight = parseFloat(batch.actualTotalWeight || '0') || 0;

        if (!isNaN(quantity)) analytics.totalQuantity += quantity;
        if (!isNaN(cost)) analytics.totalValue += cost;
        if (!isNaN(weight)) analytics.totalWeight += weight;
      }
    });

    analytics.averageRate = analytics.totalQuantity > 0 ? 
      analytics.totalValue / analytics.totalQuantity : 0;

    setAnalytics(analytics);
  };

  // ============================================================================
  // FILTER HANDLERS
  // ============================================================================
  
  const handleFilterChange = (field: keyof BatchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({ includeCompleted: true });
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (batch: StockBatch) => {
    if (batch.isCompleted) {
      return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
    }
    if (!batch.isActive) {
      return <Badge className="bg-red-100 text-red-800">Inactive</Badge>;
    }
    const utilization = parseFloat(batch.utilizationPercent);
    if (utilization === 0) {
      return <Badge className="bg-blue-100 text-blue-800">New</Badge>;
    }
    if (utilization < 50) {
      return <Badge className="bg-green-100 text-green-800">Available</Badge>;
    }
    if (utilization < 90) {
      return <Badge className="bg-yellow-100 text-yellow-800">Low Stock</Badge>;
    }
    return <Badge className="bg-orange-100 text-orange-800">Almost Empty</Badge>;
  };

  const exportToCsv = () => {
    let headers: string[];
    let csvData: string[][];

    if (isWireMesh) {
      // Wire Mesh specific CSV headers
      headers = [
        'Batch ID', 'Purchase Date', 'Supplier', 'Width', 'Roll Length', 
        'Original Qty', 'Current Qty', 'Total Area', 'Rate/Area', 'Rate/Roll',
        'Total Cost', 'Invoice', 'Status', 'Utilization %'
      ];

      csvData = batches.map(batch => [
        batch.batchId,
        formatDate(batch.purchaseDate),
        batch.supplier || 'N/A',
        batch.selectedWidth ? `${batch.selectedWidth} ${batch.widthUnit}` : 'N/A',
        batch.rollLength ? `${batch.rollLength} ${batch.rollLengthUnit}` : 'N/A',
        batch.originalQuantity,
        batch.currentQuantity,
        batch.totalArea ? `${batch.totalArea} ${batch.areaUnit}` : 'N/A',
        batch.ratePerArea ? `₹${batch.ratePerArea}/${batch.areaUnit}` : 'N/A',
        batch.ratePerUnit ? `₹${batch.ratePerUnit}` : 'N/A',
        `₹${batch.totalCostPaid}`,
        batch.invoiceNumber || 'N/A',
        batch.isCompleted ? 'Completed' : (batch.isActive ? 'Active' : 'Inactive'),
        `${batch.utilizationPercent}%`
      ]);
    } else {
      // Profile and other materials CSV headers
      headers = [
        'Batch ID', 'Purchase Date', 'Supplier', 'Length', 'Gauge', 
        'Original Qty', 'Current Qty', 'Actual Weight', 'Rate/Piece', 
        'Total Cost', 'Invoice', 'Status', 'Utilization %'
      ];

      csvData = batches.map(batch => [
        batch.batchId,
        formatDate(batch.purchaseDate),
        batch.supplier || 'N/A',
        (batch.length && batch.lengthUnit) ? `${batch.length} ${batch.lengthUnit}` : 'N/A',
        batch.gauge || 'N/A',
        batch.originalQuantity,
        batch.currentQuantity,
        batch.actualTotalWeight ? `${batch.actualTotalWeight} kg` : 'N/A',
        batch.ratePerPiece ? `₹${batch.ratePerPiece}` : (batch.ratePerUnit ? `₹${batch.ratePerUnit}` : 'N/A'),
        `₹${batch.totalCostPaid}`,
        batch.invoiceNumber || 'N/A',
        batch.isCompleted ? 'Completed' : (batch.isActive ? 'Active' : 'Inactive'),
        `${batch.utilizationPercent}%`
      ]);
    }

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch-history-${materialName}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================
  
  return (
    <div className="space-y-6">
      
      {/* ===== HEADER & ANALYTICS ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <History className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Batch History</h1>
          </div>
          <p className="text-gray-600">
            Complete transaction history for <span className="font-semibold">{materialName}</span>
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button
            onClick={exportToCsv}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ===== ANALYTICS CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Total Batches</span>
          </div>
          <div className="text-2xl font-bold">{analytics.totalBatches}</div>
          <div className="text-xs text-gray-500">
            {analytics.activeBatches} active, {analytics.completedBatches} completed
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-gray-600">Total Value</span>
          </div>
          <div className="text-2xl font-bold">₹{(analytics.totalValue || 0).toLocaleString()}</div>
          <div className="text-xs text-gray-500">
            Avg: ₹{(analytics.averageRate || 0).toFixed(2)}/{isWireMesh ? 'sqft' : 'piece'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-600">
              {isWireMesh ? 'Total Area' : 'Total Weight'}
            </span>
          </div>
          <div className="text-2xl font-bold">
            {isWireMesh ? 
              `${(analytics.totalQuantity || 0).toFixed(1)} sqft` : 
              `${(analytics.totalWeight || 0).toFixed(1)} kg`
            }
          </div>
          <div className="text-xs text-gray-500">
            {isWireMesh ? 
              `${batches.filter(b => b.isActive && !b.isCompleted).length} active rolls` :
              `${analytics.totalQuantity || 0} pieces total`
            }
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-600">Suppliers</span>
          </div>
          <div className="text-2xl font-bold">{analytics.uniqueSuppliers}</div>
          <div className="text-xs text-gray-500">unique suppliers</div>
        </Card>
      </div>

      {/* ===== FILTERS SECTION ===== */}
      {showFilters && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4" />
            <h3 className="font-semibold">Filter Batches</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <FormInput
              label="Start Date"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
            <FormInput
              label="End Date"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
            <FormInput
              label="Supplier"
              value={filters.supplier || ''}
              onChange={(e) => handleFilterChange('supplier', e.target.value)}
              placeholder="Filter by supplier"
            />
            {isProfile && (
              <FormInput
                label="Gauge"
                value={filters.gauge || ''}
                onChange={(e) => handleFilterChange('gauge', e.target.value)}
                placeholder="e.g., 18G"
              />
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.includeCompleted}
                onChange={(e) => handleFilterChange('includeCompleted', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Include completed batches</span>
            </label>
            
            <Button onClick={clearFilters} variant="outline" size="sm">
              Clear Filters
            </Button>
          </div>
        </Card>
      )}

      {/* ===== BATCH HISTORY TABLE ===== */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Specifications
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {isWireMesh ? 'Area & Quantity' : 'Quantity & Weight'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Financial
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Loading batch history...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No batch history found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.batchId} className="hover:bg-gray-50">
                    
                    {/* Batch Details */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">
                          {batch.batchId}
                        </div>
                        <div className="text-xs text-gray-500">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          {formatDate(batch.purchaseDate)}
                        </div>
                        {batch.supplier && (
                          <div className="text-xs text-gray-500">
                            <Truck className="inline h-3 w-3 mr-1" />
                            {batch.supplier}
                          </div>
                        )}
                        {batch.invoiceNumber && (
                          <div className="text-xs text-gray-500">
                            <FileText className="inline h-3 w-3 mr-1" />
                            {batch.invoiceNumber}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Specifications */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {isWireMesh ? (
                          // Wire Mesh specifications
                          <>
                            <div className="text-sm font-medium">
                              {batch.selectedWidth} {batch.widthUnit} width
                            </div>
                            {batch.rollLength && (
                              <div className="text-xs text-gray-500">
                                Roll: {batch.rollLength} {batch.rollLengthUnit}
                              </div>
                            )}
                            {batch.areaPerRoll && (
                              <div className="text-xs text-gray-500">
                                {batch.areaPerRoll} {batch.areaUnit}/roll
                              </div>
                            )}
                          </>
                        ) : (
                          // Profile and other material specifications
                          <>
                            <div className="text-sm font-medium">
                              {(batch.length && batch.lengthUnit) ? 
                                `${batch.length} ${batch.lengthUnit}` : 
                                'Standard piece'
                              }
                            </div>
                            {batch.gauge && (
                              <div className="text-xs text-gray-500">
                                Gauge: {batch.gauge}
                              </div>
                            )}
                          </>
                        )}
                        {batch.lotNumber && (
                          <div className="text-xs text-gray-500">
                            Lot: {batch.lotNumber}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Quantity & Area/Weight */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {isWireMesh ? (
                          // Wire Mesh area and quantity
                          <>
                            <div className="text-sm font-medium">
                              {batch.currentQuantity} / {batch.originalQuantity} rolls
                            </div>
                            <div className="text-xs text-gray-500">
                              Utilization: {batch.utilizationPercent}%
                            </div>
                            {batch.totalArea && (
                              <div className="text-xs text-gray-500">
                                Area: {batch.totalArea} {batch.areaUnit}
                              </div>
                            )}
                          </>
                        ) : (
                          // Profile and other material quantity
                          <>
                            <div className="text-sm font-medium">
                              {batch.currentQuantity} / {batch.originalQuantity} pcs
                            </div>
                            <div className="text-xs text-gray-500">
                              Utilization: {batch.utilizationPercent}%
                            </div>
                            {batch.actualTotalWeight && (
                              <div className="text-xs text-gray-500">
                                Weight: {batch.actualTotalWeight} kg
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Financial */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {isWireMesh ? (
                          // Wire Mesh financial info
                          <>
                            <div className="text-sm font-medium">
                              ₹{(parseFloat(batch.ratePerArea || '0') || 0).toFixed(2)}/{batch.areaUnit}
                            </div>
                            <div className="text-xs text-gray-500">
                              Total: ₹{(parseFloat(batch.totalCostPaid) || 0).toLocaleString()}
                            </div>
                            {batch.ratePerUnit && (
                              <div className="text-xs text-gray-500">
                                ₹{(parseFloat(batch.ratePerUnit) || 0).toFixed(2)}/roll
                              </div>
                            )}
                          </>
                        ) : (
                          // Profile and other material financial info
                          <>
                            <div className="text-sm font-medium">
                              ₹{(parseFloat(batch.ratePerPiece || batch.ratePerUnit || '0') || 0).toFixed(2)}/pc
                            </div>
                            <div className="text-xs text-gray-500">
                              Total: ₹{(parseFloat(batch.totalCostPaid) || 0).toLocaleString()}
                            </div>
                            {batch.ratePerKg && (
                              <div className="text-xs text-gray-500">
                                ₹{(parseFloat(batch.ratePerKg) || 0).toFixed(2)}/kg
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      {getStatusBadge(batch)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===== SUMMARY SECTION ===== */}
      {batches.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Oldest batch:</span>
              <div className="font-medium">
                {formatDate(Math.min(...batches.map(b => new Date(b.purchaseDate).getTime())).toString())}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Latest batch:</span>
              <div className="font-medium">
                {formatDate(Math.max(...batches.map(b => new Date(b.purchaseDate).getTime())).toString())}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Date range:</span>
              <div className="font-medium">
                {Math.ceil((Math.max(...batches.map(b => new Date(b.purchaseDate).getTime())) - 
                           Math.min(...batches.map(b => new Date(b.purchaseDate).getTime()))) / 
                           (1000 * 60 * 60 * 24))} days
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default BatchHistoryViewer; 