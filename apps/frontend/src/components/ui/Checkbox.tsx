import React from 'react';

interface CheckboxProps {
  id?: string;
  name?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Simple Checkbox component
 */
const Checkbox: React.FC<CheckboxProps> = ({
  id,
  name,
  checked = false,
  onCheckedChange,
  disabled = false,
  className = '',
}) => {
  return (
    <input
      type="checkbox"
      id={id}
      name={name}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      className={`h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary ${className}`}
    />
  );
};

export default Checkbox; 