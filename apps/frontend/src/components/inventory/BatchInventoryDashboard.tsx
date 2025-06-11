'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  Plus, BarChart3, Package, TrendingUp, AlertTriangle, 
  Search, Filter, Eye, Minus, History, Download,
  Layers, Scale, Clock, Target, Wrench, Monitor, Scissors, Trash2
} from 'lucide-react';
import BatchHistoryViewer from './BatchHistoryViewer';
import StockConsumptionForm from './StockConsumptionForm';
import SimplifiedMaterialCreationForm from './SimplifiedMaterialCreationForm';
import HardwareGlassCreationForm from './HardwareGlassCreationForm';
import SimplifiedBatchStockInwardForm from './SimplifiedBatchStockInwardForm';
import ConsumptionHistoryViewer from './ConsumptionHistoryViewer';
import MaterialEditForm from './MaterialEditForm';
import { 
  batchInventoryApi, 
  BatchMaterial, 
  StockBatch,
  MaterialStockReport 
} from '@/lib/api/batchInventoryService';
import { toast } from 'sonner';

type ViewMode = 'overview' | 'consumption' | 'history' | 'analytics' | 'simplifiedCreate' | 'hardwareGlassCreate' | 'simplifiedStockInward' | 'consumptionHistory' | 'editMaterial';

const BatchInventoryDashboard: React.FC = () => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [materials, setMaterials] = useState<BatchMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<BatchMaterial | null>(null);
  
  const [dashboardStats, setDashboardStats] = useState({
    totalMaterials: 0,
    totalValue: 0,
    lowStockAlerts: 0,
    activeBatches: 0
  });

  // ============================================================================
  // LOAD MATERIALS AND STATS
  // ============================================================================
  
  useEffect(() => {
    loadMaterials();
    loadDashboardStats();
  }, [searchTerm, selectedCategory]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await batchInventoryApi.getMaterials({
        search: searchTerm,
        category: selectedCategory,
        limit: 100
      });
      setMaterials(response.data);
    } catch (error) {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const [materialsResponse, lowStockAlerts, inventoryValuation] = await Promise.all([
        batchInventoryApi.getMaterials({ limit: 1000 }),
        batchInventoryApi.getLowStockAlerts(),
        batchInventoryApi.getInventoryValuation()
      ]);

      const activeBatches = materialsResponse.data.reduce((sum, material) => 
        sum + material.activeBatchCount, 0
      );

      setDashboardStats({
        totalMaterials: materialsResponse.data.length,
        totalValue: inventoryValuation.totalValue,
        lowStockAlerts: lowStockAlerts.length,
        activeBatches
      });
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  const handleMaterialSelect = (material: BatchMaterial) => {
    setSelectedMaterial(material);
    setViewMode('analytics');
  };

  const handleStockInwardSuccess = (result: any) => {
    // Refresh data after successful stock inward
    handleRefreshData();
  };

  const handleRefreshData = async () => {
    try {
      await Promise.all([loadMaterials(), loadDashboardStats()]);
    } catch (error) {
      // Error handling is already done in individual functions
    }
  };

  const handleSuccessfulConsumption = () => {
    loadMaterials();
    loadDashboardStats();
    toast.success('Stock consumed successfully');
  };

  const handleDeleteMaterial = async (material: BatchMaterial) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete "${material.name}"?\n\n` +
      `This action cannot be undone. The material can only be deleted if:\n` +
      `• No active batches exist\n` +
      `• No remaining stock\n\n` +
      `Current stock: ${parseFloat(material.aggregatedTotals.totalCurrentStock)} ${material.stockUnit}`
    );

    if (!confirmed) return;

    try {
      await batchInventoryApi.deleteMaterial(material.id);
      toast.success(`Material "${material.name}" deleted successfully`);
      
      // Refresh the materials list
      await loadMaterials();
      await loadDashboardStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete material');
    }
  };

  const resetView = () => {
    setViewMode('overview');
    setSelectedMaterial(null);
  };

  // ============================================================================
  // FILTER FUNCTIONS
  // ============================================================================
  
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (material.supplier || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || material.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(materials.map(m => m.category))];

  // ============================================================================
  // RENDER OVERVIEW
  // ============================================================================
  
  const renderOverview = () => (
    <div className="space-y-6">
      
      {/* ===== DASHBOARD STATS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Total Materials</span>
          </div>
          <div className="text-2xl font-bold">{dashboardStats.totalMaterials}</div>
          <div className="text-xs text-gray-500">Active materials</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-gray-600">Inventory Value</span>
          </div>
          <div className="text-2xl font-bold">₹{dashboardStats.totalValue.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total investment</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-medium text-gray-600">Low Stock</span>
          </div>
          <div className="text-2xl font-bold">{dashboardStats.lowStockAlerts}</div>
          <div className="text-xs text-gray-500">Materials need attention</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-600">Active Batches</span>
          </div>
          <div className="text-2xl font-bold">{dashboardStats.activeBatches}</div>
          <div className="text-xs text-gray-500">Across all materials</div>
        </Card>
      </div>

      {/* ===== QUICK ACTIONS ===== */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setViewMode('simplifiedStockInward')}
            className="bg-green-600 hover:bg-green-700"
          >
            📦 Stock Inward
          </Button>
          <Button
            onClick={() => setViewMode('simplifiedCreate')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            ⚙️ Create Profile Material
          </Button>
          <Button
            onClick={() => setViewMode('hardwareGlassCreate')}
            className="bg-purple-600 hover:bg-purple-700"
          >
            🔧 Create Hardware & Glass
          </Button>
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Quick Start:</strong> Use the streamlined creation forms for consistent material management. 
            To consume stock or view analytics, select a specific material from the table below.
          </p>
        </div>
      </Card>

      {/* ===== MATERIALS TABLE ===== */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-lg font-semibold">Materials Overview</h2>
            
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search materials..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Material
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Summary
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Financial
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batches
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Loading materials...
                  </td>
                </tr>
              ) : filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No materials found. Try adjusting your search or filters.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((material) => (
                  <tr key={material.id} className="hover:bg-gray-50">
                    
                    {/* Material Info */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">
                          {material.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {material.category}
                          {material.supplier && ` • ${material.supplier}`}
                        </div>
                        {material.hasLowStock && (
                          <Badge className="bg-yellow-100 text-yellow-800">Low Stock</Badge>
                        )}
                      </div>
                    </td>

                    {/* Stock Summary */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {parseFloat(material.aggregatedTotals.totalCurrentStock).toLocaleString()} {material.stockUnit}
                        </div>
                        <div className="text-xs text-gray-500">
                          Weight: {parseFloat(material.aggregatedTotals.totalCurrentWeight).toFixed(1)} kg
                        </div>
                        <div className="text-xs text-gray-500">
                          Updated: {new Date(material.aggregatedTotals.lastUpdated).toLocaleDateString()}
                        </div>
                      </div>
                    </td>

                    {/* Financial */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          ₹{parseFloat(material.aggregatedTotals.totalCurrentValue).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          Avg: ₹{parseFloat(material.aggregatedTotals.averageRatePerPiece).toFixed(2)}/{material.stockUnit}
                        </div>
                        {parseFloat(material.aggregatedTotals.averageRatePerKg) > 0 && (
                          <div className="text-xs text-gray-500">
                            ₹{parseFloat(material.aggregatedTotals.averageRatePerKg).toFixed(2)}/kg
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Batches */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {material.activeBatchCount} active
                        </div>
                        <div className="text-xs text-gray-500">
                          batches
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleMaterialSelect(material)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedMaterial(material);
                            setViewMode('editMaterial');
                          }}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Wrench className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDeleteMaterial(material)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  // ============================================================================
  // RENDER MATERIAL ANALYTICS
  // ============================================================================
  
  const renderMaterialAnalytics = () => {
    if (!selectedMaterial) return null;

    return (
      <div className="space-y-6">
        
        {/* ===== MATERIAL HEADER ===== */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{selectedMaterial.name}</h1>
            <p className="text-gray-600">
              {selectedMaterial.category} • {selectedMaterial.activeBatchCount} active batches
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setViewMode('simplifiedStockInward');
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Stock
            </Button>
            <Button
              onClick={() => {
                setViewMode('consumption');
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Minus className="h-4 w-4" />
              Consume
            </Button>
            <Button
              onClick={() => {
                setViewMode('history');
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              History
            </Button>
            <Button
              onClick={() => {
                setViewMode('consumptionHistory');
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Scissors className="h-4 w-4" />
              Consumption History
            </Button>
          </div>
        </div>

        {/* ===== MATERIAL STATS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Current Stock</span>
            </div>
            <div className="text-xl font-bold">
              {parseFloat(selectedMaterial.aggregatedTotals.totalCurrentStock).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">{selectedMaterial.stockUnit}</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Total Weight</span>
            </div>
            <div className="text-xl font-bold">
              {parseFloat(selectedMaterial.aggregatedTotals.totalCurrentWeight).toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">kg</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Current Value</span>
            </div>
            <div className="text-xl font-bold">
              ₹{parseFloat(selectedMaterial.aggregatedTotals.totalCurrentValue).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">investment</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-gray-600">Avg Rate</span>
            </div>
            <div className="text-xl font-bold">
              ₹{parseFloat(selectedMaterial.aggregatedTotals.averageRatePerPiece).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">per {selectedMaterial.stockUnit}</div>
          </Card>
        </div>

        {/* ===== BATCH HISTORY FOR SELECTED MATERIAL ===== */}
        <BatchHistoryViewer
          materialId={selectedMaterial.id}
          materialName={selectedMaterial.name}
          materialCategory={selectedMaterial.category}
        />
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* ===== HEADER ===== */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Batch Inventory Management
              </h1>
              <p className="text-gray-600 mt-1">
                Advanced stock management with batch tracking and exact weight preservation
              </p>
            </div>
            
            {viewMode !== 'overview' && (
              <Button
                onClick={resetView}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Back to Overview
              </Button>
            )}
          </div>
        </div>

        {/* ===== CONTENT BASED ON VIEW MODE ===== */}
        {viewMode === 'overview' && renderOverview()}
        
        {viewMode === 'consumption' && selectedMaterial && (
          <StockConsumptionForm
            materialId={selectedMaterial.id}
            materialName={selectedMaterial.name}
            onSuccess={handleSuccessfulConsumption}
            onCancel={resetView}
          />
        )}
        
        {viewMode === 'history' && selectedMaterial && (
          <BatchHistoryViewer
            materialId={selectedMaterial.id}
            materialName={selectedMaterial.name}
            materialCategory={selectedMaterial.category}
          />
        )}
        
        {viewMode === 'analytics' && renderMaterialAnalytics()}

        {viewMode === 'simplifiedStockInward' && (
          <SimplifiedBatchStockInwardForm
            onSuccess={handleStockInwardSuccess}
            onCancel={resetView}
            prefilledMaterialId={selectedMaterial ? selectedMaterial.id : undefined}
          />
        )}

        {viewMode === 'simplifiedCreate' && (
          <SimplifiedMaterialCreationForm
            isOpen={true}
            onClose={resetView}
            onSuccess={(material) => {
              resetView();
              loadMaterials();
              toast.success('Material created successfully! You can now add stock or use it in estimations.');
            }}
          />
        )}

        {viewMode === 'hardwareGlassCreate' && (
          <HardwareGlassCreationForm
            onClose={resetView}
            onSuccess={(material) => {
              resetView();
              loadMaterials();
              toast.success('Material created successfully! You can now add stock or use it in estimations.');
            }}
          />
        )}

        {viewMode === 'consumptionHistory' && selectedMaterial && (
          <ConsumptionHistoryViewer
            materialId={selectedMaterial.id}
            materialName={selectedMaterial.name}
          />
        )}

        {viewMode === 'editMaterial' && selectedMaterial && (
          <MaterialEditForm
            material={selectedMaterial}
            onSave={() => {
              handleRefreshData();
              resetView();
            }}
            onCancel={resetView}
          />
        )}
      </div>
    </div>
  );
};

export default BatchInventoryDashboard; 