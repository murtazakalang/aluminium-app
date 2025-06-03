import React from 'react';
import { useRouter } from 'next/navigation';
import { Quotation } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Edit, Send, FileText } from 'lucide-react';

interface QuotationActionsProps {
  quotation: Quotation;
  updating: boolean;
  onSend: () => void;
  onStatusUpdate: (newStatus: string) => void;
  onGeneratePDF: () => void;
}

const QuotationActions: React.FC<QuotationActionsProps> = ({
  quotation,
  updating,
  onSend,
  onStatusUpdate,
  onGeneratePDF,
}) => {
  const router = useRouter();

  const getAvailableStatuses = (currentStatus: string) => {
    switch (currentStatus) {
      case 'Draft': return ['Sent'];
      case 'Sent': return ['Viewed', 'Accepted', 'Rejected']; // Allow direct Acceptance/Rejection after sending
      case 'Viewed': return ['Accepted', 'Rejected'];
      case 'Accepted': return ['Converted']; // 'Converted' to order/invoice
      // Rejected, Expired, Converted generally don't have further manual status changes from this simple UI
      default: return [];
    }
  };

  const availableStatuses = getAvailableStatuses(quotation.status);
  const finalStatuses = ['Accepted', 'Rejected', 'Converted', 'Expired'];
  const canEdit = !finalStatuses.includes(quotation.status);
  const canSend = quotation.status === 'Draft';

  return (
    <div className="contents">
      {/* Status Updater Dropdown */}
      {availableStatuses.length > 0 && (
        <div className="flex items-center col-span-1">
          <span className="text-sm text-gray-600 mr-2">Update to:</span>
          <select
            onChange={(e) => e.target.value && onStatusUpdate(e.target.value)}
            disabled={updating}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-w-[120px]"
            defaultValue=""
          >
            <option value="" disabled>Select status...</option>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action Buttons - Each will take a grid cell */}
      {canEdit && (
        <Button
          onClick={() => router.push(`/dashboard/quotations/${quotation._id}/edit`)}
          variant="outline"
          size="sm"
          className="flex items-center col-span-1"
          disabled={updating}
        >
          <Edit className="h-4 w-4 mr-1" />
          <span>Edit</span>
        </Button>
      )}
      
      {canSend && (
        <Button
          onClick={onSend}
          disabled={updating}
          size="sm"
          className="flex items-center col-span-1"
        >
          <Send className="h-4 w-4 mr-1" />
          <span>{updating ? 'Sending...' : 'Send'}</span>
        </Button>
      )}
      
      <Button
        onClick={onGeneratePDF}
        variant="outline"
        size="sm"
        className="flex items-center col-span-1"
        disabled={updating}
      >
        <FileText className="h-4 w-4 mr-1" />
        <span>PDF</span>
      </Button>
    </div>
  );
};

export default QuotationActions; 