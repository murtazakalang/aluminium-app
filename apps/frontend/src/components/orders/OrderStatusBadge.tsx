import React from 'react';
import { Badge } from '@/components/ui/Badge';

interface OrderStatusBadgeProps {
  status: string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Measurement Confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Ready for Optimization':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Optimization Complete':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'In Production':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Cutting':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Assembly':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'QC':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Packed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Badge className={`${getStatusColor(status)} border`}>
      {status}
    </Badge>
  );
}; 