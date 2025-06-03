import React from 'react';
import Link from 'next/link';
import { ClientHistory } from '@/lib/types';

interface ClientHistoryFeedProps {
  history: ClientHistory[];
  isLoading: boolean;
}

// Define icon and color mappings for different history types
const typeIcons: Record<string, string> = {
  'Quotation': '📝',
  'Order': '📦',
  'Invoice': '💰',
  'StatusChange': '🔄',
  'Note': '📌',
};

const typeColors: Record<string, string> = {
  'Quotation': 'bg-yellow-100 text-yellow-800',
  'Order': 'bg-blue-100 text-blue-800',
  'Invoice': 'bg-green-100 text-green-800',
  'StatusChange': 'bg-purple-100 text-purple-800',
  'Note': 'bg-gray-100 text-gray-800',
};

export const ClientHistoryFeed: React.FC<ClientHistoryFeedProps> = ({ history, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse text-gray-500">Loading history...</div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500">No activity history found</div>
      </div>
    );
  }

  return (
    <div className="flow-root bg-white shadow overflow-hidden sm:rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-6">Activity History</h3>
      <ul className="-mb-8">
        {history.map((item, index) => (
          <li key={item._id}>
            <div className="relative pb-8">
              {index < history.length - 1 && (
                <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
              )}
              <div className="relative flex items-start space-x-3">
                <div className={`relative px-3 py-2 rounded-full ${typeColors[item.type] || 'bg-gray-100'}`}>
                  <span>{typeIcons[item.type] || '🔍'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {item.title}
                    {item.status && (
                      <span className="ml-2 text-sm font-medium text-gray-500">
                        ({item.status})
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <div className="mt-1 text-sm text-gray-700">
                      {item.description}
                    </div>
                  )}
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString()}
                    </span>
                    {item.documentId && (
                      <Link 
                        href={`/dashboard/${item.type.toLowerCase()}s/${item.documentId}`} 
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        View {item.type}
                      </Link>
                    )}
                    {item.amount && (
                      <span className="text-sm font-medium text-gray-900">
                        ₹{item.amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ClientHistoryFeed; 