'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { productApi, ProductType } from '@/lib/api/productService';
import { PencilIcon, ArrowLeftIcon, CalculatorIcon } from 'lucide-react';

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;
  
  const [product, setProduct] = useState<ProductType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cost calculation modal state
  const [showCostModal, setShowCostModal] = useState(false);
  const [costDimensions, setCostDimensions] = useState({ width: 0, height: 0 });
  const [costResult, setCostResult] = useState<any>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const data = await productApi.getProductById(productId);
        setProduct(data);
      } catch (err: any) {
        setError('Failed to load product. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (productId) {
      fetchProduct();
    }
  }, [productId]);
  
  const handleCalculateCost = async () => {
    if (!productId || costDimensions.width <= 0 || costDimensions.height <= 0) {
      setCostError('Please enter valid dimensions');
      return;
    }
    
    setCostLoading(true);
    setCostError(null);
    
    try {
      const result = await productApi.calculateProductCost(
        productId, 
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
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading product...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Product Details</h1>
        </div>
        
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
          <div className="mt-2">
            <button 
              onClick={() => router.push('/dashboard/products')}
              className="text-red-700 hover:underline"
            >
              Return to Products
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!product) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Product Details</h1>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-600 px-4 py-3 rounded-md">
          Product not found
          <div className="mt-2">
            <button 
              onClick={() => router.push('/dashboard/products')}
              className="text-yellow-700 hover:underline"
            >
              Return to Products
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push('/dashboard/products')}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            product.isActive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {product.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setShowCostModal(true)}
          >
            <CalculatorIcon className="h-4 w-4 mr-2" />
            Calculate Cost
          </Button>
          <Button 
            variant="default" 
            onClick={() => router.push(`/dashboard/products/${productId}/edit`)}
          >
            <PencilIcon className="h-4 w-4 mr-2" />
            Edit Product
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{product.name}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Labour Cost</p>
                <p className="font-medium">
                  {product.labourCost?.type === 'fixed' && `₹${parseFloat(product.labourCost.value || '0').toFixed(2)} per item`}
                  {product.labourCost?.type === 'perSqft' && `₹${parseFloat(product.labourCost.value || '0').toFixed(2)} per sqft`}
                  {product.labourCost?.type === 'perSqm' && `₹${parseFloat(product.labourCost.value || '0').toFixed(2)} per sqm`}
                  {product.labourCost?.type === 'percentage' && `${parseFloat(product.labourCost.value || '0').toFixed(2)}% of material cost`}
                  {!product.labourCost && 'Not set'}
                </p>
              </div>
              
              {product.description && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Description</p>
                  <p>{product.description}</p>
                </div>
              )}
              
              {product.imageUrl && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Image</p>
                  <div className="mt-2 max-w-xs overflow-hidden rounded-lg">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="w-full h-auto" 
                      onError={(e) => {
                        // Replace with a placeholder on error
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200?text=Image+Not+Found';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Materials Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Materials</h2>
            
            {product.materials.length === 0 ? (
              <p className="text-gray-500">No materials defined for this product.</p>
            ) : (
              <div className="space-y-6">
                {product.materials.map((material, index) => (
                  <div 
                    key={index} 
                    className="border rounded-md p-4"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-lg">{material.materialNameSnapshot || 'Material'}</h3>
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                        {material.materialCategorySnapshot}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Formula Input Unit</p>
                        <p>{material.formulaInputUnit}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-500">Quantity Unit</p>
                        <p>{material.quantityUnit}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-500">Requires Cutting</p>
                        <p>{material.isCutRequired ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                    
                    {material.defaultGauge && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-500">Default Gauge</p>
                        <p>{material.defaultGauge}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Formulas</p>
                      <ul className="list-disc list-inside space-y-1">
                        {material.formulas.map((formula, fIndex) => (
                          <li key={fIndex} className="text-gray-700">{formula}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Product Info Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Product Info</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Creation Date</p>
                <p className="font-medium">
                  {product.createdAt 
                    ? new Date(product.createdAt).toLocaleDateString() 
                    : 'Not available'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="font-medium">
                  {product.updatedAt 
                    ? new Date(product.updatedAt).toLocaleDateString() 
                    : 'Not available'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Number of Materials</p>
                <p className="font-medium">{product.materials.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Cost Calculator Modal */}
      {showCostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Cost Calculator for {product.name}</h3>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Width</label>
                  <input
                    type="number"
                    value={costDimensions.width}
                    onChange={(e) => setCostDimensions(prev => ({ 
                      ...prev, 
                      width: parseFloat(e.target.value) || 0 
                    }))}
                    min="0"
                    step="0.01"
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Height</label>
                  <input
                    type="number"
                    value={costDimensions.height}
                    onChange={(e) => setCostDimensions(prev => ({ 
                      ...prev, 
                      height: parseFloat(e.target.value) || 0 
                    }))}
                    min="0"
                    step="0.01"
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              </div>
              
              {costError && (
                <div className="text-red-600 text-sm">{costError}</div>
              )}
              
              <Button 
                onClick={handleCalculateCost} 
                disabled={costLoading || costDimensions.width <= 0 || costDimensions.height <= 0}
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
              <Button variant="outline" onClick={() => setShowCostModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 