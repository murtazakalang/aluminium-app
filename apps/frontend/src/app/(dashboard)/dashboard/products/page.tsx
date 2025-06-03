'use client';

import React, { useEffect, useState } from 'react';
import { productApi, ProductType } from '@/lib/api/productService';
import ProductTable from '@/components/products/ProductTable';

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await productApi.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchProducts();
  }, []);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-500">Loading products...</div>
        </div>
      ) : (
        <ProductTable products={products} onRefresh={fetchProducts} />
      )}
    </div>
  );
} 