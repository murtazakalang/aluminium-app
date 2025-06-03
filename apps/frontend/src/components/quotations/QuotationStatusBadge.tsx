import React from 'react';

interface QuotationStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const QuotationStatusBadge: React.FC<QuotationStatusBadgeProps> = ({ 
  status, 
  size = 'md' 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Sent': return 'bg-blue-100 text-blue-800';
      case 'Viewed': return 'bg-yellow-100 text-yellow-800';
      case 'Accepted': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Expired': return 'bg-orange-100 text-orange-800';
      case 'Converted': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm': return 'px-2 py-1 text-xs';
      case 'lg': return 'px-4 py-2 text-base';
      default: return 'px-3 py-1 text-sm';
    }
  };

  return (
    <span 
      className={`
        inline-flex items-center rounded-full font-medium
        ${getStatusColor(status)} 
        ${getSizeClasses(size)}
      `}
    >
      {status}
    </span>
  );
};

export default QuotationStatusBadge; 