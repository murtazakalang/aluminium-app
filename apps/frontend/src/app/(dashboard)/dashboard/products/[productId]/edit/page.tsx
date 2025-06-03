'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { productApi, ProductType } from '@/lib/api/productService';
import ProductForm from '@/components/products/ProductForm';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;
  
  const [product, setProduct] = useState<ProductType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
          <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
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
          <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
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
        <h1 className="text-2xl font-bold tracking-tight">Edit Product: {product.name}</h1>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <ProductForm initialData={product} isEdit={true} />
      </div>
    </div>
  );
} 