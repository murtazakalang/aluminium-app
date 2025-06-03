import React from 'react';

interface TableProps<T> {
  columns: {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
  }[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  emptyStateMessage?: string;
  isLoading?: boolean;
  className?: string;
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyStateMessage = 'No data available',
  isLoading = false,
  className = '',
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-gray-500">Loading data...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">{emptyStateMessage}</div>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${
                  column.className || ''
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.map((item) => (
            <tr key={keyExtractor(item)}>
              {columns.map((column, index) => (
                <td
                  key={index}
                  className={`whitespace-nowrap px-6 py-4 text-sm text-gray-900 ${
                    column.className || ''
                  }`}
                >
                  {typeof column.accessor === 'function'
                    ? column.accessor(item)
                    : item[column.accessor] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 