'use client';

import React from 'react';
import ProductForm from '@/components/products/ProductForm';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Create New Product</h1>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <ProductForm />
      </div>
    </div>
  );
} 