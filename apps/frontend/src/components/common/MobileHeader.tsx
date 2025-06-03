import React from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { Menu, Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface MobileHeaderProps {
  onMenuToggle?: () => void;
  title?: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onMenuToggle,
  title = 'Aluminium ERP'
}) => {
  const { user } = useAuthStore();

  return (
    <header className="bg-white shadow-sm border-b md:hidden sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onMenuToggle}
            className="p-2"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="text-lg font-semibold text-gray-900">{title}</div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="p-2"
          >
            <Bell className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-gray-900">
                {user?.firstName || 'User'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader; 