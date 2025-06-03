'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BatchInventoryDashboard from '@/components/inventory/BatchInventoryDashboard';

export default function InventoryPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-gray-600">Manage your materials, stock levels, and batch tracking</p>
      </div>
      
      <BatchInventoryDashboard />
    </div>
  );
} 