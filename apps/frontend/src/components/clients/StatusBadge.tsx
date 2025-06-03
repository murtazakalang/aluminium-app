import React from 'react';

type StatusType = 'New Lead' | 'In Discussion' | 'Quoted' | 'Negotiation' | 'Converted' | 'Dropped';

interface StatusBadgeProps {
  status: StatusType;
}

const statusColors: Record<StatusType, string> = {
  'New Lead': 'bg-blue-100 text-blue-800',
  'In Discussion': 'bg-purple-100 text-purple-800',
  'Quoted': 'bg-yellow-100 text-yellow-800',
  'Negotiation': 'bg-orange-100 text-orange-800',
  'Converted': 'bg-green-100 text-green-800',
  'Dropped': 'bg-gray-100 text-gray-800',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
};

export default StatusBadge; 