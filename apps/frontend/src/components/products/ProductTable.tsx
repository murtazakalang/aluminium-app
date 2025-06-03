import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { productApi, ProductType } from '@/lib/api/productService';
import { Eye, Edit, Trash2, Search, Calculator } from 'lucide-react';

// Custom table components to match the existing Table component
const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-gray-50">
    {children}
  </thead>
);

const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="divide-y divide-gray-200 bg-white">
    {children}
  </tbody>
);

const TableRow = ({ children }: { children: React.ReactNode }) => (
  <tr>{children}</tr>
);

const TableHead = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <th
    scope="col"
    className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${className}`}
  >
    {children}
  </th>
);

const TableCell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td
    className={`whitespace-nowrap px-6 py-4 text-sm text-gray-900 ${className}`}
  >
    {children}
  </td>
);

// Extend the Table component with the custom components
const CustomTable = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      {children}
    </table>
  </div>
);

// Add the components as properties
CustomTable.Header = TableHeader;
CustomTable.Body = TableBody;
CustomTable.Row = TableRow;
CustomTable.Head = TableHead;
CustomTable.Cell = TableCell;

interface ProductTableProps {
  products: ProductType[];
  onRefresh: () => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, onRefresh }) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  
  // Cost calculation modal state
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [costDimensions, setCostDimensions] = useState({ width: 0, height: 0 });
  const [costResult, setCostResult] = useState<any>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  
  // Filter products by search term
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDeleteClick = (productId: string) => {
    setShowDeleteConfirm(productId);
  };
  
  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };
  
  const handleConfirmDelete = async (productId: string) => {
    setLoading(productId);
    try {
      await productApi.deleteProduct(productId);
      setShowDeleteConfirm(null);
      onRefresh(); // Refresh the product list
    } catch (error) {
      // Show error toast here if necessary
    } finally {
      setLoading(null);
    }
  };
  
  const handleCostCalculatorClick = (productId: string) => {
    setSelectedProductId(productId);
    setCostDimensions({ width: 0, height: 0 });
    setCostResult(null);
    setCostError(null);
    setShowCostModal(true);
  };
  
  const handleCalculateCost = async () => {
    if (!selectedProductId || costDimensions.width <= 0 || costDimensions.height <= 0) {
      setCostError('Please enter valid dimensions');
      return;
    }
    
    setCostLoading(true);
    setCostError(null);
    
    try {
      const result = await productApi.calculateProductCost(
        selectedProductId, 
        costDimensions.width, 
        costDimensions.height
      );
      setCostResult(result);
    } catch (error: any) {
      setCostError(error.message || 'Error calculating cost');
    } finally {
      setCostLoading(false);
    }
  };
  
  const handleCloseCostModal = () => {
    setShowCostModal(false);
    setSelectedProductId(null);
    setCostResult(null);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => router.push('/dashboard/products/new')}>
          Add New Product
        </Button>
      </div>
      
      {filteredProducts.length === 0 ? (
        <div className="text-center p-8 border border-dashed rounded-lg">
          {searchTerm ? 'No products match your search.' : 'No products added yet.'}
        </div>
      ) : (
        <CustomTable>
          <CustomTable.Header>
            <CustomTable.Row>
              <CustomTable.Head>Name</CustomTable.Head>
              <CustomTable.Head>Description</CustomTable.Head>
              <CustomTable.Head>Materials</CustomTable.Head>
              <CustomTable.Head>Status</CustomTable.Head>
              <CustomTable.Head className="text-right">Actions</CustomTable.Head>
            </CustomTable.Row>
          </CustomTable.Header>
          <CustomTable.Body>
            {filteredProducts.map((product) => (
              <CustomTable.Row key={product._id}>
                <CustomTable.Cell className="font-medium">{product.name}</CustomTable.Cell>
                <CustomTable.Cell className="max-w-md truncate">
                  {product.description || 'No description'}
                </CustomTable.Cell>
                <CustomTable.Cell>{product.materials.length} materials</CustomTable.Cell>
                <CustomTable.Cell>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    product.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </CustomTable.Cell>
                <CustomTable.Cell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCostCalculatorClick(product._id || '')}
                    disabled={loading === product._id}
                  >
                    <Calculator className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/dashboard/products/${product._id}`)}
                    disabled={loading === product._id}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/dashboard/products/${product._id}/edit`)}
                    disabled={loading === product._id}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(product._id || '')}
                    disabled={loading === product._id}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CustomTable.Cell>
              </CustomTable.Row>
            ))}
          </CustomTable.Body>
        </CustomTable>
      )}
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={loading !== null}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleConfirmDelete(showDeleteConfirm)}
                disabled={loading !== null}
              >
                {loading === showDeleteConfirm ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Cost Calculator Modal */}
      {showCostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Cost Calculator</h3>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Width</label>
                  <Input
                    type="number"
                    value={costDimensions.width}
                    onChange={(e) => setCostDimensions(prev => ({ 
                      ...prev, 
                      width: parseFloat(e.target.value) || 0 
                    }))}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Height</label>
                  <Input
                    type="number"
                    value={costDimensions.height}
                    onChange={(e) => setCostDimensions(prev => ({ 
                      ...prev, 
                      height: parseFloat(e.target.value) || 0 
                    }))}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              
              {costError && (
                <div className="text-red-600 text-sm">{costError}</div>
              )}
              
              <Button 
                onClick={handleCalculateCost} 
                disabled={costLoading || !selectedProductId || costDimensions.width <= 0 || costDimensions.height <= 0}
                className="w-full"
              >
                {costLoading ? 'Calculating...' : 'Calculate Cost'}
              </Button>
            </div>
            
            {costResult && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-semibold mb-2">Results</h4>
                
                <div className="mb-2">
                  <div className="flex justify-between font-medium">
                    <span>Total Cost:</span>
                    <span>${costResult.totalCost.toFixed(2)}</span>
                  </div>
                </div>
                
                {costResult.breakdown && (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium mb-2">Breakdown:</h5>
                    <div className="max-h-60 overflow-y-auto">
                      {costResult.breakdown.map((item: any, index: number) => (
                        <div key={index} className="text-sm border-b border-gray-100 py-2">
                          <div className="flex justify-between">
                            <span>{item.materialName}</span>
                            <span>${item.cost.toFixed(2)}</span>
                          </div>
                          <div className="text-gray-500 text-xs">
                            {item.quantity} {item.quantityUnit} × ${item.rate}/{item.rateUnit}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {costResult.errors && costResult.errors.length > 0 && (
                  <div className="mt-4 text-yellow-600 text-sm">
                    <h5 className="font-medium mb-1">Warnings:</h5>
                    <ul className="list-disc pl-5">
                      {costResult.errors.map((error: string, index: number) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end mt-6">
              <Button variant="outline" onClick={handleCloseCostModal}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductTable; 