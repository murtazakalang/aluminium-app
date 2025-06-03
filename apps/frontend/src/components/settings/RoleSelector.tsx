'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';

interface RoleSelectorProps {
  value: string;
  onChange: (role: string) => void;
  error?: string;
}

export default function RoleSelector({ value, onChange, error }: RoleSelectorProps) {
  const { user } = useAuthStore();
  const [roles, setRoles] = useState<string[]>(['Admin', 'Manager', 'Staff']);

  // Only show Admin role if the current user is an Admin
  const displayRoles = user?.role === 'Admin' 
    ? roles 
    : roles.filter(role => role !== 'Admin');

  return (
    <div className="w-full">
      <label htmlFor="role" className="block text-sm font-medium text-gray-700">
        Role
      </label>
      <select
        id="role"
        name="role"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm ${
          error ? 'border-red-500' : ''
        }`}
      >
        <option value="" disabled>
          Select a role
        </option>
        {displayRoles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
} 