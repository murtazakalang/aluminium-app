'use client';

import React, { useState, useEffect } from 'react';
import { quotationApi } from '@/lib/api/quotationService';
import { Button } from '@/components/ui/Button';
import { Download, Eye, Grid3X3, Columns, Rows } from 'lucide-react';

interface QuotationSVGPreviewProps {
  quotationId: string;
  itemId?: string; // If provided, shows only this item
  showLayoutOptions?: boolean;
}

type LayoutType = 'grid' | 'vertical' | 'horizontal';

const QuotationSVGPreview: React.FC<QuotationSVGPreviewProps> = ({
  quotationId,
  itemId,
  showLayoutOptions = true
}) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [allItemsSVGs, setAllItemsSVGs] = useState<any[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>('grid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'individual' | 'layout'>('individual');

  // Load individual item SVG
  const loadItemSVG = async () => {
    if (!itemId) return;
    
    try {
      setLoading(true);
      setError(null);
      const svg = await quotationApi.generateItemSVG(quotationId, itemId);
      setSvgContent(svg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SVG');
    } finally {
      setLoading(false);
    }
  };

  // Load all items SVGs
  const loadAllItemsSVGs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await quotationApi.generateAllItemsSVG(quotationId);
      setAllItemsSVGs(response.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SVGs');
    } finally {
      setLoading(false);
    }
  };

  // Load layout SVG
  const loadLayoutSVG = async () => {
    try {
      setLoading(true);
      setError(null);
      const svg = await quotationApi.generateLayoutSVG(quotationId, selectedLayout);
      setSvgContent(svg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load layout SVG');
    } finally {
      setLoading(false);
    }
  };

  // Download SVG
  const downloadSVG = (svgData: string, filename: string) => {
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Load data on mount or when parameters change
  useEffect(() => {
    if (itemId) {
      loadItemSVG();
    } else if (viewMode === 'individual') {
      loadAllItemsSVGs();
    } else {
      loadLayoutSVG();
    }
  }, [quotationId, itemId, viewMode, selectedLayout]);

  const handleLayoutChange = (layout: LayoutType) => {
    setSelectedLayout(layout);
    if (viewMode === 'layout') {
      loadLayoutSVG();
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">Error: {error}</p>
          <Button 
            onClick={() => itemId ? loadItemSVG() : (viewMode === 'layout' ? loadLayoutSVG() : loadAllItemsSVGs())} 
            className="mt-2"
            size="sm"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">SVG Preview</h2>
        
        <div className="flex items-center space-x-2">
          {!itemId && showLayoutOptions && (
            <>
              {/* View Mode Toggle */}
              <div className="flex border rounded-md">
                <button
                  onClick={() => setViewMode('individual')}
                  className={`px-3 py-1 text-sm ${
                    viewMode === 'individual' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Eye className="h-4 w-4 inline mr-1" />
                  Individual
                </button>
                <button
                  onClick={() => setViewMode('layout')}
                  className={`px-3 py-1 text-sm ${
                    viewMode === 'layout' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Grid3X3 className="h-4 w-4 inline mr-1" />
                  Layout
                </button>
              </div>

              {/* Layout Options */}
              {viewMode === 'layout' && (
                <div className="flex border rounded-md">
                  <button
                    onClick={() => handleLayoutChange('grid')}
                    className={`px-2 py-1 text-sm ${
                      selectedLayout === 'grid' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Grid Layout"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleLayoutChange('horizontal')}
                    className={`px-2 py-1 text-sm ${
                      selectedLayout === 'horizontal' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Horizontal Layout"
                  >
                    <Columns className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleLayoutChange('vertical')}
                    className={`px-2 py-1 text-sm ${
                      selectedLayout === 'vertical' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Vertical Layout"
                  >
                    <Rows className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Download Button */}
          {svgContent && (
            <Button
              onClick={() => downloadSVG(
                svgContent, 
                itemId 
                  ? `item-${itemId}.svg` 
                  : `quotation-${quotationId}-${viewMode === 'layout' ? 'layout' : 'items'}.svg`
              )}
              size="sm"
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download SVG
            </Button>
          )}
        </div>
      </div>

      {/* SVG Display */}
      {viewMode === 'individual' && !itemId ? (
        // Display individual items
        <div className="space-y-6">
          {allItemsSVGs.map((item, index) => (
            <div key={item.itemId} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">
                  {item.itemLabel || `Item ${index + 1}`} - {item.productType}
                </h3>
                <Button
                  onClick={() => downloadSVG(item.svgContent, `item-${item.itemId}.svg`)}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {item.dimensions.width} × {item.dimensions.height} {item.dimensions.unit} (Qty: {item.quantity})
              </p>
              <div 
                className="svg-container border border-gray-200 rounded bg-gray-50 p-4 overflow-auto"
                dangerouslySetInnerHTML={{ __html: item.svgContent }}
              />
            </div>
          ))}
        </div>
      ) : (
        // Display single item or layout
        svgContent && (
          <div 
            className="svg-container border border-gray-200 rounded bg-gray-50 p-4 overflow-auto"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )
      )}

      {!svgContent && !allItemsSVGs.length && !loading && (
        <div className="text-center text-gray-500 py-8">
          No SVG content available
        </div>
      )}
    </div>
  );
};

export default QuotationSVGPreview; 