import React, { useState } from 'react';
import { clientApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';

type StatusType = 'New Lead' | 'In Discussion' | 'Quoted' | 'Negotiation' | 'Converted' | 'Dropped';

interface StatusUpdaterProps {
  clientId: string;
  currentStatus: StatusType;
  onStatusUpdate: (newStatus: StatusType) => void;
}

export const StatusUpdater: React.FC<StatusUpdaterProps> = ({ clientId, currentStatus, onStatusUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const statuses: StatusType[] = [
    'New Lead',
    'In Discussion',
    'Quoted', 
    'Negotiation',
    'Converted',
    'Dropped'
  ];
  
  const handleStatusChange = async (status: StatusType) => {
    if (status === currentStatus) {
      setIsOpen(false);
      return;
    }
    
    setIsLoading(true);
    try {
      await clientApi.updateStatus(clientId, status);
      onStatusUpdate(status);
      setIsOpen(false);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="relative">
      <Button 
        type="button"
        variant="secondary"
        disabled={isLoading}
        onClick={() => setIsOpen(!isOpen)}
      >
        Change Status
      </Button>
      
      {isOpen && (
        <div className="absolute mt-2 w-48 rounded-md shadow-lg bg-white z-10 ring-1 ring-black ring-opacity-5">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`${
                  currentStatus === status ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                } group flex w-full items-center px-4 py-2 text-sm hover:bg-gray-100`}
                role="menuitem"
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusUpdater; 