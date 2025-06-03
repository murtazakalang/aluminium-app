import * as React from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({
  open = false,
  onOpenChange,
  children,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50" 
        onClick={() => onOpenChange && onOpenChange(false)} 
      />
      <div className="z-10 w-full max-w-lg rounded-lg bg-white shadow-lg">
        {children}
      </div>
    </div>
  );
};

interface DialogContentProps {
  className?: string;
  children?: React.ReactNode;
}

const DialogContent: React.FC<DialogContentProps> = ({
  className,
  children,
}) => {
  return (
    <div className={cn("p-6", className)}>
      {children}
    </div>
  );
};

interface DialogHeaderProps {
  className?: string;
  children?: React.ReactNode;
}

const DialogHeader: React.FC<DialogHeaderProps> = ({
  className,
  children,
}) => {
  return (
    <div className={cn("mb-4", className)}>
      {children}
    </div>
  );
};

interface DialogTitleProps {
  className?: string;
  children?: React.ReactNode;
}

const DialogTitle: React.FC<DialogTitleProps> = ({
  className,
  children,
}) => {
  return (
    <h2 className={cn("text-lg font-semibold text-gray-900", className)}>
      {children}
    </h2>
  );
};

export { Dialog, DialogContent, DialogHeader, DialogTitle }; 