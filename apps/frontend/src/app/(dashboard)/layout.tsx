'use client';

import React from 'react';
import Sidebar from '@/components/common/Sidebar';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { UnitProvider } from '@/contexts/UnitContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SettingsProvider>
      <UnitProvider>
      <ProtectedRoute>
        <div className="flex h-screen bg-gray-100">
          {/* Sidebar */}
          <div className="w-64">
            <Sidebar />
          </div>
          
          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Mobile header - could be extracted to a component */}
            <header className="bg-white shadow-sm md:hidden">
              <div className="flex h-16 items-center justify-between px-4">
                <div className="text-lg font-semibold">Aluminium ERP</div>
                <div>
                  {/* Mobile menu button would go here */}
                </div>
              </div>
            </header>
            
            {/* Main content area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </ProtectedRoute>
      </UnitProvider>
    </SettingsProvider>
  );
} 