import React, { useState, useEffect } from 'react';
import { QuotationItem } from '@/lib/types';
import { productApi, ProductType } from '@/lib/api/productService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2 } from 'lucide-react';
import { calculateItemDetailsFrontend } from '@/lib/utils/quotationCalculatorFrontend';
import GlassAndFrameSelector from './GlassAndFrameSelector';

interface QuotationItemFormProps {
  items: QuotationItem[];
  onChange: (items: QuotationItem[]) => void;
  dimensionUnit?: 'inches' | 'mm';
  areaUnit?: 'sqft' | 'sqm';
  readOnly?: boolean;
}

const QuotationItemForm: React.FC<QuotationItemFormProps> = ({
  items,
  onChange,
  dimensionUnit = 'inches',
  areaUnit = 'sqft',
  readOnly = false
}) => {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProductTypes = async () => {
      try {
        const data = await productApi.getProducts();
        setProductTypes(data);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    loadProductTypes();
  }, []);

  const handleItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    onChange(updatedItems);
  };

  const handleGlassTypeChange = (index: number, glassTypeId: string, glassTypeName: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { 
      ...updatedItems[index], 
      selectedGlassTypeId: glassTypeId || undefined,
      selectedGlassTypeNameSnapshot: glassTypeName || undefined
    };
    onChange(updatedItems);
  };

  const handleFrameColourChange = (index: number, frameColour: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { 
      ...updatedItems[index], 
      frameColour: frameColour || undefined
    };
    onChange(updatedItems);
  };

  // Helper to get product with glass formula
  const getProductGlassFormula = (productId: string) => {
    const product = productTypes.find(p => p._id === productId);
    return product?.glassAreaFormula;
  };

  const addItem = () => {
    const newItem: QuotationItem = {
      productTypeId: '',
      width: 0,
      height: 0,
      quantity: 1,
      itemLabel: '',
      pricePerAreaUnit: 0,
      selectedGlassTypeId: undefined,
      selectedGlassTypeNameSnapshot: undefined,
      frameColour: undefined
    };
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const updatedItems = items.filter((_, i) => i !== index);
      onChange(updatedItems);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Quotation Items</h2>
        {!readOnly && (
          <Button
            type="button"
            onClick={addItem}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const previewDetails = calculateItemDetailsFrontend(
            item,
            dimensionUnit,
            areaUnit,
            true
          );

          return (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Item {index + 1}</h3>
                {!readOnly && items.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeItem(index)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Type *
                  </label>
                  {readOnly ? (
                    <div className="py-2">
                      {item.productTypeNameSnapshot || productTypes.find(p => p?._id?.toString() === item.productTypeId?.toString())?.name || item.productTypeId || 'Unknown Product'}
                    </div>
                  ) : (
                    <>
                      <select
                        value={item.productTypeId || ''}
                        onChange={(e) => handleItemChange(index, 'productTypeId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select a product type...</option>
                        {productTypes
                          .filter(pt => pt?._id)
                          .map((productType) => (
                          <option key={productType._id!.toString()} value={productType._id!.toString()}>
                            {productType.name}
                          </option>
                        ))}
                      </select>
                      {!loading && item.productTypeId && 
                       !productTypes.some(p => p?._id?.toString() === item.productTypeId?.toString()) && (
                        <p className="mt-1 text-sm text-red-500">Warning: Original product type (ID: {item.productTypeId}) not found or is inactive.</p>
                      )}
                    </>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width ({dimensionUnit}) *
                  </label>
                  {readOnly ? (
                    <div className="py-2">{item.width}</div>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      value={item.width}
                      onChange={(e) => handleItemChange(index, 'width', parseFloat(e.target.value) || 0)}
                      required
                    />
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height ({dimensionUnit}) *
                  </label>
                  {readOnly ? (
                    <div className="py-2">{item.height}</div>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      value={item.height}
                      onChange={(e) => handleItemChange(index, 'height', parseFloat(e.target.value) || 0)}
                      required
                    />
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  {readOnly ? (
                    <div className="py-2">{item.quantity}</div>
                  ) : (
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      required
                    />
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per {areaUnit} *
                  </label>
                  {readOnly ? (
                    <div className="py-2">₹{item.pricePerAreaUnit}</div>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      value={item.pricePerAreaUnit}
                      onChange={(e) => handleItemChange(index, 'pricePerAreaUnit', parseFloat(e.target.value) || 0)}
                      required
                    />
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Label (Optional)
                </label>
                {readOnly ? (
                  <div className="py-2">{item.itemLabel || '—'}</div>
                ) : (
                  <Input
                    type="text"
                    placeholder="e.g., Living Room Window"
                    value={item.itemLabel || ''}
                    onChange={(e) => handleItemChange(index, 'itemLabel', e.target.value)}
                  />
                )}
              </div>

              {/* Glass and Frame Selection for products with glass formulas */}
              {getProductGlassFormula(item.productTypeId) && (
                <div className="col-span-full mt-4 pt-4 border-t">
                  <GlassAndFrameSelector
                    selectedGlassTypeId={item.selectedGlassTypeId}
                    selectedGlassTypeName={item.selectedGlassTypeNameSnapshot}
                    frameColour={item.frameColour}
                    onGlassTypeChange={(glassTypeId, glassTypeName) => 
                      handleGlassTypeChange(index, glassTypeId, glassTypeName)
                    }
                    onFrameColourChange={(frameColour) => 
                      handleFrameColourChange(index, frameColour)
                    }
                    displayOnly={false}
                    disabled={readOnly}
                  />
                </div>
              )}

              {!readOnly && (item.width > 0 && item.height > 0 && item.pricePerAreaUnit > 0 && item.quantity > 0) && (
                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">Preview - Final Area:</span> {previewDetails.finalChargeableAreaPerItem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {areaUnit}
                  </div>
                  <div className="text-sm text-blue-800 mt-1">
                    <span className="font-medium">Preview - Est. Cost:</span> ₹{previewDetails.itemSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuotationItemForm; 