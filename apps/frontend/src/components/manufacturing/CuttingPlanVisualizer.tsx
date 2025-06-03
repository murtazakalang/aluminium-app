'use client';

import React, { useState, useEffect } from 'react';
import { manufacturingApi } from '@/lib/api/manufacturingService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download } from 'lucide-react';

interface CuttingPlanVisualizerProps {
  orderId: string;
}

export function CuttingPlanVisualizer({ orderId }: CuttingPlanVisualizerProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchSvg = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await manufacturingApi.getCuttingPlanSvg(orderId);
        setSvgContent(response.data.svg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load visualization');
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId) {
      fetchSvg();
    }
  }, [orderId]);

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      setError(null);
      
      const blob = await manufacturingApi.downloadCuttingPlanPdf(orderId);
      
      if (!blob || blob.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      // Create a more robust download approach
      try {
        // Method 1: Try standard download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Cutting-Plan-${orderId}.pdf`;
        link.style.display = 'none';
        
        // Add to DOM, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL after a delay
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 1000);
        
      } catch (downloadError) {
        
        // Method 2: Try alternative download approach
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center items-center h-32">
          <div className="text-gray-500">Loading cutting plan visualization...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="text-red-600">
          {error}
        </div>
      </Card>
    );
  }

  if (!svgContent) {
    return (
      <Card className="p-6 bg-gray-50">
        <div className="text-gray-600 text-center">
          No cutting plan visualization available.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Cutting Plan Layout</h3>
        <Button
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Download size={16} />
          {isDownloading ? 'Generating PDF...' : 'Download PDF'}
        </Button>
      </div>
      <div 
        className="w-full"
        dangerouslySetInnerHTML={{ __html: svgContent }} 
        aria-label="Cutting plan visualization"
      />
    </Card>
  );
} 