'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';

interface SubMenuItem {
  name: string;
  href: string;
  current: boolean;
  adminOnly?: boolean;
}

interface NavigationItem {
  name: string;
  href: string;
  current: boolean;
  submenu?: SubMenuItem[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const isAdmin = user?.role === 'Admin';
  
  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navigation: NavigationItem[] = [
    { name: 'Dashboard', href: '/dashboard', current: pathname === '/dashboard' },
    { name: 'Clients', href: '/dashboard/clients', current: pathname.includes('/dashboard/clients') },
    { name: 'Inventory', href: '/dashboard/inventory', current: pathname.includes('/dashboard/inventory') },
    { name: 'Products', href: '/dashboard/products', current: pathname.includes('/dashboard/products') },
    { name: 'Estimations', href: '/dashboard/estimations', current: pathname.includes('/dashboard/estimations') },
    { name: 'Quotations', href: '/dashboard/quotations', current: pathname.includes('/dashboard/quotations') },
    { name: 'Orders', href: '/dashboard/orders', current: pathname.includes('/dashboard/orders') },
    { name: 'Invoices', href: '/dashboard/invoices', current: pathname.includes('/dashboard/invoices') },
    { name: 'Accounting', href: '/dashboard/accounting', current: pathname.includes('/dashboard/accounting') },
    { name: 'Reports', href: '/dashboard/reports', current: pathname.includes('/dashboard/reports') },
    { name: 'Settings', href: '/dashboard/settings/company', current: pathname.includes('/dashboard/settings/company') },
];

  return (
    <div className="flex h-full flex-col border-r bg-white">
      <div className="flex flex-col overflow-y-auto">
        <div className="flex h-16 shrink-0 items-center border-b px-6">
          <span className="text-lg font-semibold">Aluminium ERP</span>
        </div>
        <nav className="flex-1 px-4 py-4">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                {!item.submenu ? (
                  <Link
                    href={item.href}
                    className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                      item.current ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <>
                    <div
                      className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                        item.current ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {item.name}
                    </div>
                    <ul className="ml-6 mt-1 space-y-1">
                      {item.submenu
                        .filter((subitem: SubMenuItem) => !subitem.adminOnly || (subitem.adminOnly && isAdmin))
                        .map((subitem: SubMenuItem) => (
                          <li key={subitem.name}>
                            <Link
                              href={subitem.href}
                              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                                subitem.current ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              {subitem.name}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mt-auto border-t p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </div>
  );
} 