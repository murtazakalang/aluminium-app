'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Share2 } from 'lucide-react';
import ManufacturingReportView from '@/components/reports/ManufacturingReportView';
import { toast } from 'sonner';

export default function ManufacturingReportPage() {
  const handleExport = () => {
    // TODO: Implement export functionality
    toast.info('Export functionality coming soon');
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    toast.info('Share functionality coming soon');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Reports
          </Link>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={handleShare}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manufacturing Analytics Report</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor cutting efficiency, material performance, and production optimization metrics
        </p>
      </div>

      {/* Report Content */}
      <ManufacturingReportView />
    </div>
  );
} 