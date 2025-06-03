import * as React from 'react';
import { Input, InputProps } from './Input';

interface FormInputProps extends Omit<InputProps, 'className'> {
  label: string;
  error?: string;
  className?: string;
}

export function FormInput({
  label,
  id,
  error,
  className = '',
  ...props
}: FormInputProps) {
  return (
    <div className={`w-full ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">
        <Input
          id={id}
          className={`w-full ${error ? 'border-red-500' : ''}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
} 