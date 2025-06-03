import React, { useState, useEffect } from 'react';
import { orderApi, type RequiredCut, type StockAvailability, type StockItemDetail, type Order } from '@/lib/api/orderService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Table from '@/components/ui/Table';

interface RequiredCutsViewProps {
  orderId: string;
  orderStatus: string;
}

interface GlassRequirement {
  itemNumber: number;
  material: string;
  category: string;
  width: number;
  height: number;
  widthUnit: string;
  heightUnit: string;
  totalGlassPieces: number;
}

// Helper function to format stock details into a string like (1 x 12.00ft)(2 x 15.00ft)
const formatStockDetails = (details: StockItemDetail[]): string => {
  if (!details || details.length === 0) return '—';
  return details
    .map(item => {
      // Handle both numeric and string length values
      const lengthDisplay = typeof item.length === 'number' 
        ? item.length.toFixed(2) 
        : item.length; // For wire mesh dimensions like "2ft x 3.75ft"
      return `(${item.count} x ${lengthDisplay}${item.unit})`;
    })
    .join('');
};

export const RequiredCutsView: React.FC<RequiredCutsViewProps> = ({
  orderId,
  orderStatus,
}) => {
  const [requiredCuts, setRequiredCuts] = useState<RequiredCut[]>([]);
  const [stockAvailability, setStockAvailability] = useState<StockAvailability[]>([]);
  const [glassRequirements, setGlassRequirements] = useState<GlassRequirement[]>([]);
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [isLoadingCuts, setIsLoadingCuts] = useState(false);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewCuts = ['Measurement Confirmed', 'Ready for Optimization', 'Optimization Complete', 'In Production', 'Cutting'].includes(orderStatus);
  const canCheckStock = ['Measurement Confirmed', 'Ready for Optimization'].includes(orderStatus);

  // Simple formula evaluator for basic math expressions
  const evaluateFormula = (formula: string, variables: { [key: string]: number }): { result: number | null, error: string | null } => {
    try {
      // Replace variables in formula
      let expression = formula;
      for (const [variable, value] of Object.entries(variables)) {
        const regex = new RegExp(variable, 'g');
        expression = expression.replace(regex, value.toString());
      }
      
      // Basic safety check - only allow numbers, operators, and parentheses
      if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
        return { result: null, error: 'Formula contains invalid characters' };
      }
      
      // Evaluate the expression
      const result = eval(expression);
      
      if (typeof result !== 'number' || isNaN(result)) {
        return { result: null, error: 'Formula did not evaluate to a valid number' };
      }
      
      return { result, error: null };
    } catch (err) {
      return { result: null, error: 'Invalid formula syntax' };
    }
  };

  const fetchOrderData = async () => {
    try {
      setIsLoadingOrder(true);
      setError(null);
      const response = await orderApi.getOrder(orderId);
      const order = response.data.order;
      setOrderData(order);
      
      // Calculate glass requirements from order items
      const glassReqs: GlassRequirement[] = [];
      
      order.items.forEach((item, index) => {
        if (item.selectedGlassTypeNameSnapshot) {
          // Get glass formula from product type
          const productType = item.productTypeId as any;
          const glassFormula = productType?.glassAreaFormula;
          
          let calculatedWidth = parseFloat(item.finalWidth.toString());
          let calculatedHeight = parseFloat(item.finalHeight.toString());
          let totalGlassPieces = 1;
          
          if (glassFormula && glassFormula.widthFormula && glassFormula.heightFormula) {
            const widthInput = parseFloat(item.finalWidth.toString());
            const heightInput = parseFloat(item.finalHeight.toString());
            
            // Apply width formula
            if (glassFormula.widthFormula.trim()) {
              const widthResult = evaluateFormula(glassFormula.widthFormula, { W: widthInput, H: heightInput });
              if (!widthResult.error && widthResult.result !== null) {
                calculatedWidth = widthResult.result;
              }
            }
            
            // Apply height formula
            if (glassFormula.heightFormula.trim()) {
              const heightResult = evaluateFormula(glassFormula.heightFormula, { W: widthInput, H: heightInput });
              if (!heightResult.error && heightResult.result !== null) {
                calculatedHeight = heightResult.result;
              }
            }
            
            // Use glass quantity from formula
            totalGlassPieces = glassFormula.glassQuantity || 1;
          }
          
          glassReqs.push({
            itemNumber: index + 1,
            material: item.selectedGlassTypeNameSnapshot,
            category: 'Glass',
            width: calculatedWidth,
            height: calculatedHeight,
            widthUnit: order.dimensionUnit || 'inches',
            heightUnit: order.dimensionUnit || 'inches',
            totalGlassPieces: totalGlassPieces,
          });
        }
      });
      
      setGlassRequirements(glassReqs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order data');
    } finally {
      setIsLoadingOrder(false);
    }
  };

  const fetchRequiredCuts = async () => {
    if (!canViewCuts) return;

    try {
      setIsLoadingCuts(true);
      setError(null);
      const apiResponse = await orderApi.getRequiredCuts(orderId) as any; // Cast to any

      let cutsToSet: RequiredCut[] = [];

      if (apiResponse && apiResponse.data) {
        const requiredCutsData = apiResponse.data.requiredCuts;
        if (Array.isArray(requiredCutsData)) {
          cutsToSet = requiredCutsData;
        } else if (typeof requiredCutsData === 'object' && requiredCutsData !== null) {
          // If it's a non-null object, and not an array,
          // we check if it has properties that identify it as a single cut object (e.g., materialId).
          // An empty object {} would result in an empty cutsToSet.
          if (Object.keys(requiredCutsData).length > 0 && requiredCutsData.materialId) { 
            cutsToSet = [requiredCutsData as RequiredCut]; // Wrap the single object in an array
          } else {
            // It's an empty object {} or doesn't look like a valid single cut object
            cutsToSet = []; 
          }
        } else {
          // cutsToSet remains []
        }
      } else if (Array.isArray(apiResponse)) { 
        // Fallback if orderApi.getRequiredCuts directly returned an array (e.g., if API client changes)
        cutsToSet = apiResponse;
      } else {
        // cutsToSet remains []
      }
      setRequiredCuts(cutsToSet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch required cuts');
      setRequiredCuts([]); // Ensure it's an array on error
    } finally {
      setIsLoadingCuts(false);
    }
  };

  const checkStock = async () => {
    if (!canCheckStock) return;

    try {
      setIsLoadingStock(true);
      setError(null);
      const response = await orderApi.checkStock(orderId);
      setStockAvailability(response.data.detailedStockAvailability || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check stock availability');
      setStockAvailability([]); // Ensure it's an array on error
    } finally {
      setIsLoadingStock(false);
    }
  };

  const downloadStockCheckPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      setError(null);
      
      const blob = await orderApi.generateStockCheckPDF(orderId);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stock-check-${orderData?.orderIdDisplay || orderId}.pdf`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download stock check PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  useEffect(() => {
    fetchOrderData();
    fetchRequiredCuts();
  }, [orderId, orderStatus]);

  const formatCutLength = (length: number, unit: string) => {
    return `${length.toFixed(2)} ${unit}`;
  };

  const getStockStatusBadge = (status: StockAvailability['status']) => {
    switch (status) {
      case 'Sufficient':
      case 'Sufficient (Simplified Check)':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Sufficient</Badge>;
      case 'Insufficient':
      case 'Insufficient (Simplified Check)':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Insufficient</Badge>;
      case 'Material Not Found':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Not Found</Badge>;
      case 'More Scrap if Use Xft': // Example for future status
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">More Scrap</Badge>;
      case 'N/A (Non-Profile)':
         return <Badge className="bg-gray-100 text-gray-700 border-gray-200">N/A</Badge>;
      case 'Pending Detailed Check':
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Pending Check</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>;
    }
  };

  // Transform required cuts data for the table
  const cutsTableData = requiredCuts.map((cut, index) => ({
    id: cut.materialId || index.toString(),
    materialName: cut.materialName,
    category: cut.category,
    totalCuts: cut.requiredCuts.length,
    totalLength: parseFloat(cut.requiredCuts.reduce((sum, length) => sum + Number(length), 0).toFixed(2)),
    usageUnit: cut.usageUnit,
    cutLengths: cut.requiredCuts.map(length => `${Number(length).toFixed(2)} ${cut.usageUnit}`).join(', '),
  }));

  const cutsColumns = [
    { header: 'Material', accessor: 'materialName' as const },
    { header: 'Category', accessor: 'category' as const },
    { header: 'Total Cuts', accessor: 'totalCuts' as const },
    { header: 'Total Length', accessor: 'totalLength' as const },
    { header: 'Unit', accessor: 'usageUnit' as const },
    { header: 'Cut Lengths', accessor: 'cutLengths' as const },
  ];

  // Transform stock availability data for the table using new structure
  const stockTableData = stockAvailability.map((stock, index) => ({
    id: stock.materialId || index.toString(),
    materialName: stock.materialName,
    status: getStockStatusBadge(stock.status),
    required: formatStockDetails(stock.requiredCutsDetail),
    available: formatStockDetails(stock.availableStockDetail),
    shortfall: formatStockDetails(stock.shortfallDetail),
  }));

  const stockColumns = [
    { header: 'Material', accessor: 'materialName' as const },
    { header: 'Status', accessor: 'status' as const },
    { header: 'Required', accessor: 'required' as const },
    { header: 'Available', accessor: 'available' as const },
    { header: 'Shortfall', accessor: 'shortfall' as const },
  ];

  // Transform glass requirements data for the table
  const glassTableData = glassRequirements.map((glass, index) => ({
    id: index.toString(),
    itemNumber: glass.itemNumber,
    material: glass.material,
    category: glass.category,
    dimensions: `${glass.width} ${glass.widthUnit} × ${glass.height} ${glass.heightUnit}`,
    width: `${glass.width} ${glass.widthUnit}`,
    height: `${glass.height} ${glass.heightUnit}`,
    totalGlassPieces: glass.totalGlassPieces,
  }));

  const glassColumns = [
    { header: 'Window Number', accessor: 'itemNumber' as const },
    { header: 'Material', accessor: 'material' as const },
    { header: 'Category', accessor: 'category' as const },
    { header: 'Width', accessor: 'width' as const },
    { header: 'Height', accessor: 'height' as const },
    { header: 'Total Glass Pieces', accessor: 'totalGlassPieces' as const },
  ];

  if (!canViewCuts) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>Required cuts can only be viewed for orders with confirmed measurements or in production stages.</p>
          <p className="text-sm mt-2">Current status: {orderStatus}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {/* Required Cuts */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Required Material Cuts</h2>
          <Button
            onClick={fetchRequiredCuts}
            variant="outline"
            size="sm"
            disabled={isLoadingCuts}
          >
            {isLoadingCuts ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {isLoadingCuts ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading required cuts...</p>
          </div>
        ) : requiredCuts.length > 0 ? (
          <Table
            columns={cutsColumns}
            data={cutsTableData}
            keyExtractor={(item) => item.id}
            emptyStateMessage="No required cuts found"
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No required cuts available for this order.</p>
          </div>
        )}
      </Card>

      {/* Glass Required */}
      {glassRequirements.length > 0 && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Glass Required</h2>
            <Button
              onClick={fetchOrderData}
              variant="outline"
              size="sm"
              disabled={isLoadingOrder}
            >
              {isLoadingOrder ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          {isLoadingOrder ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading glass requirements...</p>
            </div>
          ) : (
            <Table
              columns={glassColumns}
              data={glassTableData}
              keyExtractor={(item) => item.id}
              emptyStateMessage="No glass requirements found"
            />
          )}
        </Card>
      )}

      {/* Stock Availability */}
      {canCheckStock && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Stock Availability</h2>
            <div className="flex space-x-2">
              <Button
                onClick={checkStock}
                variant="default"
                size="sm"
                disabled={isLoadingStock || isGeneratingPDF}
              >
                {isLoadingStock ? 'Checking...' : 'Check Stock'}
              </Button>
              {stockAvailability.length > 0 && (
                <Button
                  onClick={downloadStockCheckPDF}
                  variant="outline"
                  size="sm"
                  disabled={isGeneratingPDF || isLoadingStock}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                >
                  {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF'}
                </Button>
              )}
            </div>
          </div>

          {stockAvailability.length > 0 ? (
            <Table
              columns={stockColumns}
              data={stockTableData}
              keyExtractor={(item) => item.id}
              emptyStateMessage="No stock data available"
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Click "Check Stock" to verify material availability.</p>
            </div>
          )}
        </Card>
      )}

      {/* Summary */}
      {requiredCuts.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stockAvailability.filter(s => s.category === 'Profile').length > 0 ? stockAvailability.filter(s => s.category === 'Profile').length : requiredCuts.length}
              </div>
              <div className="text-sm text-gray-600">Profile Materials Required</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {requiredCuts.reduce((sum, cut) => sum + cut.requiredCuts.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Profile Cuts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stockAvailability.filter(stock => 
                  stock.status === 'Sufficient' || 
                  stock.status === 'Sufficient (Simplified Check)' ||
                  (stock.status === 'More Scrap if Use Xft' && stock.shortfallDetail.length === 0) // Count "More Scrap" as "in stock" if shortfall is empty
                ).length}
              </div>
              <div className="text-sm text-gray-600">Profile Materials in Stock</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}; 