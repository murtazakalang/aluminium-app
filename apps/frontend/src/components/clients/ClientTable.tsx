import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/types';
import StatusBadge from '@/components/clients/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { StatusUpdater } from './StatusUpdater';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

interface ClientTableProps {
  clients: Client[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onSearch: (search: string) => void;
  onStatusFilter: (status: string) => void;
  onStatusUpdate: (clientId: string, newStatus: any) => void;
  onDeleteClient: (clientId: string) => Promise<void>;
  isLoading?: boolean;
}

export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  total,
  page,
  limit,
  onPageChange,
  onSearch,
  onStatusFilter,
  onStatusUpdate,
  onDeleteClient,
  isLoading = false,
}) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const totalPages = Math.ceil(total / limit);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'New Lead', label: 'New Lead' },
    { value: 'In Discussion', label: 'In Discussion' },
    { value: 'Quoted', label: 'Quoted' },
    { value: 'Negotiation', label: 'Negotiation' },
    { value: 'Converted', label: 'Converted' },
    { value: 'Dropped', label: 'Dropped' },
  ];
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const handleDeleteClick = (clientId: string) => {
    setClientToDelete(clientId);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    
    setIsDeleting(true);
    try {
      await onDeleteClient(clientToDelete);
      setDialogOpen(false);
      setClientToDelete(null);
    } catch (error) {
    } finally {
      setIsDeleting(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setClientToDelete(null);
  };
  
  // Transform clients data to format required by Table component
  const tableData = clients.map(client => ({
    id: client._id,
    clientName: (
      <Link href={`/dashboard/clients/${client._id}`} className="text-blue-600 hover:text-blue-800 font-medium">
        {client.clientName}
      </Link>
    ),
    contactPerson: client.contactPerson || '—',
    contactNumber: client.contactNumber,
    email: client.email || '—',
    followUpStatus: <StatusBadge status={client.followUpStatus} />,
    actions: (
      <div className="flex space-x-2">
        <StatusUpdater 
          clientId={client._id} 
          currentStatus={client.followUpStatus}
          onStatusUpdate={(newStatus) => onStatusUpdate(client._id, newStatus)} 
        />
        <Button 
          onClick={() => router.push(`/dashboard/clients/${client._id}/edit`)}
          variant="outline"
          size="sm"
        >
          Edit
        </Button>
        <Button 
          onClick={() => handleDeleteClick(client._id)}
          variant="destructive"
          size="sm"
        >
          Delete
        </Button>
      </div>
    )
  }));
  
  // Define the columns with properly typed accessors
  const columns = [
    { header: 'Client Name', accessor: 'clientName' as const },
    { header: 'Contact Person', accessor: 'contactPerson' as const },
    { header: 'Contact Number', accessor: 'contactNumber' as const },
    { header: 'Email', accessor: 'email' as const },
    { header: 'Status', accessor: 'followUpStatus' as const },
    { header: 'Actions', accessor: 'actions' as const },
  ];
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <form onSubmit={handleSearch} className="flex w-full md:w-1/3">
          <Input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-r-none"
          />
          <Button type="submit" variant="default" className="rounded-l-none">
            Search
          </Button>
        </form>
        
        <div>
          <select
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            onChange={(e) => onStatusFilter(e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <Table 
        columns={columns}
        data={tableData}
        keyExtractor={(item) => item.id}
        emptyStateMessage="No clients found"
        isLoading={isLoading}
      />
      
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <nav className="flex items-center">
            <Button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              variant="outline"
              size="sm"
              className="mr-2"
            >
              Previous
            </Button>
            <span className="mx-4">
              Page {page} of {totalPages}
            </span>
            <Button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              variant="outline"
              size="sm"
              className="ml-2"
            >
              Next
            </Button>
          </nav>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={dialogOpen}
        onClose={closeDialog}
        onConfirm={confirmDelete}
        title="Delete Client"
        message="Are you sure you want to delete this client? This action will deactivate the client record."
        confirmButtonText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ClientTable; 