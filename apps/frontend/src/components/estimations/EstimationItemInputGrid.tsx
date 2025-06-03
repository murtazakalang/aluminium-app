import React, { useState, useEffect } from 'react';
import { EstimationItem } from '@/lib/api/estimationService';
import { productApi, ProductType } from '@/lib/api/productService';
import GlassTypeSelector from './GlassTypeSelector';

interface EstimationItemInputGridProps {
  items: EstimationItem[];
  onChange: (items: EstimationItem[]) => void;
  dimensionUnit: 'inches' | 'mm' | 'ft' | 'm';
  readOnly?: boolean;
}

const EstimationItemInputGrid: React.FC<EstimationItemInputGridProps> = ({
  items,
  onChange,
  dimensionUnit,
  readOnly = false
}) => {
  const [localItems, setLocalItems] = useState<EstimationItem[]>(items || []);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState<EstimationItem>({
    productTypeId: '',
    width: 0,
    height: 0,
    quantity: 1,
    itemLabel: '',
    selectedGlassTypeId: undefined,
    selectedGlassTypeNameSnapshot: '',
    calculatedGlassQuantity: 0,
    calculatedGlassUnit: 'sqft',
    calculatedGlassCost: 0
  });

  // Fetch product types when component mounts
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await productApi.getProducts();
        setProducts(data);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Update local state when props change
  useEffect(() => {
    setLocalItems(items || []);
  }, [items]);

  const handleAddItem = () => {
    if (!newItem.productTypeId || newItem.width <= 0 || newItem.height <= 0 || newItem.quantity < 1) {
      return;
    }

    const updatedItems = [...localItems, newItem];
    setLocalItems(updatedItems);
    setNewItem({
      productTypeId: '',
      width: 0,
      height: 0,
      quantity: 1,
      itemLabel: '',
      selectedGlassTypeId: undefined,
      selectedGlassTypeNameSnapshot: '',
      calculatedGlassQuantity: 0,
      calculatedGlassUnit: 'sqft',
      calculatedGlassCost: 0
    });
    onChange(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = localItems.filter((_, i) => i !== index);
    setLocalItems(updatedItems);
    onChange(updatedItems);
  };

  const handleItemChange = (
    index: number, 
    field: keyof EstimationItem, 
    value: string | number
  ) => {
    const updatedItems = localItems.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setLocalItems(updatedItems);
    onChange(updatedItems);
  };

  const handleGlassTypeChange = (
    index: number,
    glassTypeId: string | undefined,
    glassCost: number,
    glassTypeName: string
  ) => {
    const updatedItems = localItems.map((item, i) =>
      i === index ? {
        ...item,
        selectedGlassTypeId: glassTypeId,
        selectedGlassTypeNameSnapshot: glassTypeName,
        calculatedGlassCost: glassCost
      } : item
    );
    setLocalItems(updatedItems);
    onChange(updatedItems);
  };

  const handleNewItemGlassTypeChange = (
    glassTypeId: string | undefined,
    glassCost: number,
    glassTypeName: string
  ) => {
    setNewItem(prev => ({
      ...prev,
      selectedGlassTypeId: glassTypeId,
      selectedGlassTypeNameSnapshot: glassTypeName,
      calculatedGlassCost: glassCost
    }));
  };

  // Helper to get product name by id
  const getProductName = (productId: string) => {
    const product = products.find(p => p._id === productId);
    return product ? product.name : 'Unknown Product';
  };

  // Helper to get product with glass formula
  const getProductGlassFormula = (productId: string) => {
    const product = products.find(p => p._id === productId);
    return product?.glassAreaFormula;
  };

  if (loading) {
    return <div className="text-center p-4">Loading products...</div>;
  }

  return (
    <div className="bg-white p-4 rounded-md shadow">
      <h3 className="text-lg font-medium mb-4">Estimation Items</h3>

      {localItems.length === 0 && (
        <p className="text-gray-500 italic mb-4">No items added yet.</p>
      )}

      {localItems.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-12 gap-4 font-medium text-sm text-gray-500 mb-2">
            <div className="col-span-3">Product Type</div>
            <div className="col-span-2">Width ({dimensionUnit})</div>
            <div className="col-span-2">Height ({dimensionUnit})</div>
            <div className="col-span-1">Qty</div>
            <div className="col-span-2">Label</div>
            <div className="col-span-2"></div>
          </div>

          {localItems.map((item, index) => {
            const productGlassFormula = getProductGlassFormula(item.productTypeId);
            
            return (
              <div key={index} className="mb-4 p-3 border border-gray-200 rounded-md">
                <div className="grid grid-cols-12 gap-4 mb-2">
              <div className="col-span-3">
                {readOnly ? (
                  <div className="py-2">{getProductName(item.productTypeId)}</div>
                ) : (
                  <select
                    value={item.productTypeId}
                    onChange={(e) => handleItemChange(index, 'productTypeId', e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
                  >
                    <option value="">Select Product</option>
                    {products.map((product) => (
                      <option key={product._id} value={product._id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="col-span-2">
                {readOnly ? (
                  <div className="py-2">{item.width}</div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.width}
                    onChange={(e) => handleItemChange(index, 'width', parseFloat(e.target.value))}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
                    placeholder={`Width (${dimensionUnit})`}
                  />
                )}
              </div>
              <div className="col-span-2">
                {readOnly ? (
                  <div className="py-2">{item.height}</div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.height}
                    onChange={(e) => handleItemChange(index, 'height', parseFloat(e.target.value))}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
                    placeholder={`Height (${dimensionUnit})`}
                  />
                )}
              </div>
              <div className="col-span-1">
                {readOnly ? (
                  <div className="py-2">{item.quantity}</div>
                ) : (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
                    placeholder="Qty"
                  />
                )}
              </div>
              <div className="col-span-2">
                {readOnly ? (
                  <div className="py-2">{item.itemLabel || '-'}</div>
                ) : (
                  <input
                    type="text"
                    value={item.itemLabel || ''}
                    onChange={(e) => handleItemChange(index, 'itemLabel', e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
                    placeholder="Label (optional)"
                  />
                )}
              </div>
              <div className="col-span-2">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
                
                {/* Glass Type Selection for products with glass formulas */}
                {productGlassFormula && !readOnly && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <GlassTypeSelector
                      selectedGlassTypeId={item.selectedGlassTypeId}
                      onGlassTypeChange={(glassTypeId, glassCost, glassTypeName) => 
                        handleGlassTypeChange(index, glassTypeId, glassCost, glassTypeName)
                      }
                      width={item.width}
                      height={item.height}
                      quantity={item.quantity}
                      productGlassAreaFormula={productGlassFormula}
                    />
                  </div>
                )}
                
                {/* Display glass info in read-only mode */}
                {productGlassFormula && readOnly && item.selectedGlassTypeNameSnapshot && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Glass Type:</span> {item.selectedGlassTypeNameSnapshot}
                      {item.calculatedGlassCost && (
                        <span className="ml-4">
                          <span className="font-medium">Glass Cost:</span> ₹{Number(item.calculatedGlassCost).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && (
        <div className="p-3 border-2 border-dashed border-gray-300 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Item</h4>
          
          <div className="grid grid-cols-12 gap-4 mb-3">
          <div className="col-span-3">
            <select
              value={newItem.productTypeId}
              onChange={(e) => setNewItem({ ...newItem, productTypeId: e.target.value })}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
            >
              <option value="">Select Product</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={newItem.width || ''}
              onChange={(e) => setNewItem({ ...newItem, width: parseFloat(e.target.value) })}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
              placeholder={`Width (${dimensionUnit})`}
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={newItem.height || ''}
              onChange={(e) => setNewItem({ ...newItem, height: parseFloat(e.target.value) })}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
              placeholder={`Height (${dimensionUnit})`}
            />
          </div>
          <div className="col-span-1">
            <input
              type="number"
              min="1"
              step="1"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
              placeholder="Qty"
            />
          </div>
          <div className="col-span-2">
            <input
              type="text"
              value={newItem.itemLabel || ''}
              onChange={(e) => setNewItem({ ...newItem, itemLabel: e.target.value })}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 sm:text-sm border-gray-300 rounded-md"
              placeholder="Label (optional)"
            />
          </div>
          <div className="col-span-2">
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Add Item
            </button>
          </div>
          </div>

          {/* Glass selection for new item if product has glass formula */}
          {getProductGlassFormula(newItem.productTypeId) && (
            <div className="pt-3 border-t border-gray-200">
              <GlassTypeSelector
                selectedGlassTypeId={newItem.selectedGlassTypeId}
                onGlassTypeChange={handleNewItemGlassTypeChange}
                width={newItem.width}
                height={newItem.height}
                quantity={newItem.quantity}
                productGlassAreaFormula={getProductGlassFormula(newItem.productTypeId)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EstimationItemInputGrid; 