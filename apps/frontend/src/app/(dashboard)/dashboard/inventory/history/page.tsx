'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import StockHistoryTable from '@/components/inventory/StockHistoryTable';

// Define types for stock transactions and materials
interface Material {
  _id: string;
  name: string;
  category: string;
}

interface StockTransaction {
  _id: string;
  materialId: string;
  type: 'Inward' | 'Outward-Manual' | 'Outward-OrderCut' | 'Scrap' | 'Correction' | 'InitialStock';
  length?: string;
  lengthUnit?: string;
  quantityChange: string;
  quantityUnit: string;
  relatedDocumentType?: string;
  relatedDocumentId?: string;
  notes?: string;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  transactionDate: string;
}

// Mock data for stock transactions
const mockTransactions: StockTransaction[] = [
  {
    _id: '1',
    materialId: '1', // 3Track Top Rail
    type: 'Inward',
    length: '12',
    lengthUnit: 'ft',
    quantityChange: '5',
    quantityUnit: 'pcs',
    notes: 'Initial stock entry',
    createdBy: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe'
    },
    transactionDate: '2023-06-01T10:00:00Z'
  },
  {
    _id: '2',
    materialId: '1', // 3Track Top Rail
    type: 'Outward-OrderCut',
    length: '12',
    lengthUnit: 'ft',
    quantityChange: '2',
    quantityUnit: 'pcs',
    relatedDocumentType: 'Order',
    relatedDocumentId: 'order123',
    notes: 'Used for Order #123',
    createdBy: {
      _id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith'
    },
    transactionDate: '2023-06-02T14:30:00Z'
  },
  {
    _id: '3',
    materialId: '2', // 3Track Bottom Rail
    type: 'Inward',
    length: '16',
    lengthUnit: 'ft',
    quantityChange: '7',
    quantityUnit: 'pcs',
    notes: 'Initial stock entry',
    createdBy: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe'
    },
    transactionDate: '2023-06-01T10:30:00Z'
  },
  {
    _id: '4',
    materialId: '3', // Clear Glass 5mm
    type: 'Inward',
    quantityChange: '120',
    quantityUnit: 'sqft',
    notes: 'Initial stock entry',
    createdBy: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe'
    },
    transactionDate: '2023-06-01T11:00:00Z'
  },
  {
    _id: '5',
    materialId: '3', // Clear Glass 5mm
    type: 'Outward-Manual',
    quantityChange: '25',
    quantityUnit: 'sqft',
    notes: 'Manual removal for testing',
    createdBy: {
      _id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith'
    },
    transactionDate: '2023-06-03T09:15:00Z'
  }
];

// Mock data for materials
const mockMaterials: Material[] = [
  {
    _id: '1',
    name: '3Track Top Rail',
    category: 'Profile'
  },
  {
    _id: '2',
    name: '3Track Bottom Rail',
    category: 'Profile'
  },
  {
    _id: '3',
    name: 'Clear Glass 5mm',
    category: 'Glass'
  }
];

export default function StockHistoryPage() {
  const searchParams = useSearchParams();
  const materialIdParam = searchParams.get('materialId');
  
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<StockTransaction[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stock transaction history
  useEffect(() => {
    const fetchStockHistory = async () => {
      try {
        setIsLoading(true);
        
        // In a real implementation, this would be an API call
        // For now, simulate a delay and use mock data
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set materials data
        setMaterials(mockMaterials);
        
        // Set transactions data
        setTransactions(mockTransactions);
        
        // Apply material filter if materialId parameter exists
        if (materialIdParam) {
          setFilteredTransactions(mockTransactions.filter(t => t.materialId === materialIdParam));
        } else {
          setFilteredTransactions(mockTransactions);
        }
        
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load stock transaction history');
        setIsLoading(false);
      }
    };
    
    fetchStockHistory();
  }, [materialIdParam]);

  // Handlers for filtering
  const handleMaterialFilter = (materialId: string | null) => {
    if (!materialId) {
      setFilteredTransactions(transactions);
    } else {
      setFilteredTransactions(transactions.filter(t => t.materialId === materialId));
    }
  };

  const handleTypeFilter = (type: string | null) => {
    if (!type) {
      // If no type filter but material filter might be active
      handleMaterialFilter(materialIdParam);
    } else {
      // Apply both material and type filters if needed
      let filtered = transactions.filter(t => t.type === type);
      if (materialIdParam) {
        filtered = filtered.filter(t => t.materialId === materialIdParam);
      }
      setFilteredTransactions(filtered);
    }
  };

  const handleDateRangeFilter = (startDate: string | null, endDate: string | null) => {
    let filtered = [...transactions];
    
    // Apply material filter if active
    if (materialIdParam) {
      filtered = filtered.filter(t => t.materialId === materialIdParam);
    }
    
    // Apply date filters
    if (startDate) {
      const startTimestamp = new Date(startDate).getTime();
      filtered = filtered.filter(t => new Date(t.transactionDate).getTime() >= startTimestamp);
    }
    
    if (endDate) {
      const endTimestamp = new Date(endDate + 'T23:59:59').getTime();
      filtered = filtered.filter(t => new Date(t.transactionDate).getTime() <= endTimestamp);
    }
    
    setFilteredTransactions(filtered);
  };

  const handleExport = () => {
    // In a real implementation, this would trigger a CSV export
    // For now, just log the transactions that would be exported
    alert('CSV export functionality would be implemented here');
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 p-4 rounded-md text-red-800">
          <h2 className="text-lg font-medium">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Transaction History</h1>
        <p className="text-gray-600 mt-1">
          View and filter all stock movements, including inward, outward, and adjustments
        </p>
      </div>

      <StockHistoryTable
        transactions={filteredTransactions}
        materials={materials}
        isLoading={isLoading}
        onMaterialFilter={handleMaterialFilter}
        onTypeFilter={handleTypeFilter}
        onDateRangeFilter={handleDateRangeFilter}
        onExport={handleExport}
      />
    </div>
  );
} 