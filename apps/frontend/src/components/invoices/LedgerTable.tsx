import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { FileText, CreditCard } from 'lucide-react';

// Define a more accurate type for the 'entry' prop based on actual invoice data received
interface LedgerEntryData {
  _id: string;
  invoiceDate?: string; // Actually received
  invoiceIdDisplay?: string;
  clientSnapshot?: { clientName?: string }; // Actually received
  grandTotal?: string | number; // Actually received (as string in log)
  // Fields from original SalesLedgerEntry that might be missing or need mapping:
  // type: 'Invoice' | 'Payment'; // Can be hardcoded or derived if only invoices
  // description: string;
  // creditAmount?: number;
  // runningBalance?: number;
  [key: string]: any; // Allow other invoice properties
}

interface LedgerTableProps {
  entries: LedgerEntryData[]; // Use the more accurate type
  loading?: boolean;
}

// Helper function to parse numeric values (can be moved to a util if used elsewhere)
const parseNumericValue = (value: any): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'object' && value !== null && value.hasOwnProperty('$numberDecimal')) {
    return parseFloat(value.$numberDecimal);
  }
  if (typeof value === 'string') {
    return parseFloat(value);
  }
  return 0; // Default or throw error
};

export default function LedgerTable({ entries, loading }: LedgerTableProps) {
  const formatCurrency = (amount: string | number | undefined) => {
    const numericAmount = parseNumericValue(amount);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(numericAmount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getTypeIcon = (/* type: 'Invoice' | 'Payment' */) => {
    // Assuming type is implicitly 'Invoice' as we are iterating over invoice objects
    return <FileText className="h-4 w-4" />;
  };

  const getTypeBadge = (/* type: 'Invoice' | 'Payment' */) => {
    // Assuming type is implicitly 'Invoice'
    return (
      <Badge className={`inline-flex items-center gap-1 bg-blue-100 text-blue-800`}>
        {getTypeIcon(/* 'Invoice' */)}
        Invoice
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Running Balance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[...Array(5)].map((_, index) => (
              <tr key={index} className="animate-pulse">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-48"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-auto">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Invoice ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Debit
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Credit
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Running Balance
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {(entries || []).map((entry) => {
            const description = `Invoice ${entry.invoiceIdDisplay || ''}`;
            const debitAmount = entry.grandTotal; // Will be parsed by formatCurrency
            const creditAmount = 0; // For invoice entry
            const runningBalance = undefined; // No source from invoice object for running balance

            return (
              <tr key={entry._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(entry.invoiceDate)} 
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getTypeBadge(/* entry.type */)} 
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.invoiceIdDisplay || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {entry.clientSnapshot?.clientName || '-'} 
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                  {description} 
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-medium">
                  {debitAmount ? formatCurrency(debitAmount) : '-'} 
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium">
                  {creditAmount ? formatCurrency(creditAmount) : '-'} 
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                  {runningBalance ? formatCurrency(runningBalance) : '-'} 
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(entries || []).length === 0 && (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
          <p className="text-gray-500">Sales ledger entries will appear here as invoices are created and payments are recorded.</p>
        </div>
      )}
    </div>
  );
} 