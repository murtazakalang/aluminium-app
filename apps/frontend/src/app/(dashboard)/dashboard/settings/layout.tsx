'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';

const settingsLinks = [
  { name: 'Company', href: '/dashboard/settings/company', description: 'Manage company profile' },
  { name: 'General', href: '/dashboard/settings/general', description: 'Units, GST, Terms & Conditions' },
  { name: 'Charges', href: '/dashboard/settings/charges', description: 'Predefined charges for quotations' },
  { name: 'Staff', href: '/dashboard/settings/staff', description: 'Manage staff members' },
  { name: 'Notifications', href: '/dashboard/settings/notifications', description: 'Configure notification preferences' },
];

const resourceLinks = [
  { name: 'Help Center', href: '/dashboard/help', description: 'User guides and documentation' },
  { name: 'Changelog', href: '/dashboard/changelog', description: 'View system updates' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';

  // Filter out staff management if not admin
  const filteredSettings = settingsLinks.filter(
    link => link.name !== 'Staff' || isAdmin
  );

  return (
    <div className="space-y-6">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-gray-500">
          Manage your account, company and system preferences.
        </p>
      </div>
      
      {/* Horizontal navigation tabs instead of a sidebar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {filteredSettings.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                pathname === item.href || (item.href !== '/dashboard/settings/company' && pathname.startsWith(item.href))
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
      
      {/* Content area */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        {children}
      </div>

      {/* Resources section */}
      <div className="mt-8 space-y-4">
        <div className="border-b border-gray-200 pb-2">
          <h3 className="text-sm font-medium text-gray-500">Resources</h3>
        </div>
        <div className="flex space-x-4">
          {resourceLinks.map((resource) => (
            <Link
              key={resource.name}
              href={resource.href}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {resource.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 