import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Invoice } from '@/lib/api/invoiceService';

interface InvoiceStatusBadgeProps {
  status: Invoice['status'];
  className?: string;
}

export default function InvoiceStatusBadge({ status, className = '' }: InvoiceStatusBadgeProps) {
  const statusConfig = {
    'Draft': {
      className: 'bg-gray-100 text-gray-800',
      label: 'Draft'
    },
    'Sent': {
      className: 'bg-blue-100 text-blue-800',
      label: 'Sent'
    },
    'Partially Paid': {
      className: 'bg-yellow-100 text-yellow-800',
      label: 'Partially Paid'
    },
    'Paid': {
      className: 'bg-green-100 text-green-800',
      label: 'Paid'
    },
    'Overdue': {
      className: 'bg-red-100 text-red-800',
      label: 'Overdue'
    },
    'Void': {
      className: 'bg-gray-100 text-gray-600',
      label: 'Void'
    }
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} ${className}`}>
      {config.label}
    </Badge>
  );
} 