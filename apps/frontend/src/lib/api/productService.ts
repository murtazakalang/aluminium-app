import { api } from '../api';

// Type definitions based on ProductType model
export interface Material {
  materialId: string;
  materialNameSnapshot?: string;
  materialCategorySnapshot?: string;
  formulas: string[];
  formulaInputUnit: 'inches' | 'mm' | 'ft' | 'm';
  quantityUnit: 'ft' | 'inches' | 'mm' | 'sqft' | 'sqm' | 'pcs' | 'kg';
  isCutRequired: boolean;
  defaultGauge?: string;
}

// Glass formula type definition - using separate formulas for optimal glass cutting
export interface GlassFormula {
  // Separate width and height formulas for precise glass cutting optimization
  widthFormula: string;
  heightFormula: string;
  glassQuantity: number;
  
  formulaInputUnit: 'inches' | 'mm' | 'ft' | 'm';
  outputUnit: 'sqft' | 'sqm';
  description: string;
}

// NEW: Technical Drawing SVG interface
export interface TechnicalDrawing {
  svgContent: string;
  prompt: string;
  generatedAt: Date;
  generatedBy?: string;
  isActive: boolean;
}

export interface ProductType {
  _id?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  materials: Material[];
  // NEW: Glass area formula
  glassAreaFormula?: GlassFormula;
  // NEW: Technical drawing SVG
  technicalDrawing?: TechnicalDrawing;
  labourCost?: {
    type: 'fixed' | 'perSqft' | 'perSqm' | 'percentage';
    value: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductCostResult {
  totalCost: number;
  breakdown: {
    materialId?: string;
    materialName: string;
    materialCategory: string;
    quantity: number;
    quantityUnit: string;
    rate: number;
    rateUnit: string;
    cost: number;
    note?: string;
  }[];
  errors?: string[];
  message?: string;
}

// NEW: Glass formula validation result
export interface GlassFormulaValidationResult {
  valid: boolean;
  error?: string;
  testResults?: {
    width: number;
    height: number;
    calculatedArea: number;
    unit: string;
    // NEW: Enhanced glass details for separate formulas
    glassDetails?: {
      piecesPerItem: number;
      totalPieces: number;
      glassCutSize: string;
      adjustedWidth: number;
      adjustedHeight: number;
      roundedWidth: number;
      roundedHeight: number;
      areaPerPiece: number;
    };
  }[];
}

// NEW: SVG Generation interfaces
export interface SVGGenerationRequest {
  prompt: string;
}

export interface SVGGenerationResponse {
  message: string;
  productId: string;
  productName: string;
  technicalDrawing: {
    svgContent: string;
    prompt: string;
    generatedAt: Date;
    isActive: boolean;
  };
}

export interface SVGUpdateRequest {
  svgContent?: string;
  prompt?: string;
  isActive?: boolean;
}

// API functions for Product Type management
export const productApi = {
  // Get all products
  getProducts: () => 
    api<ProductType[]>('/api/products'),

  // Get a single product by ID
  getProductById: (productId: string) => 
    api<ProductType>(`/api/products/${productId}`),

  // Create a new product
  createProduct: (productData: ProductType) => 
    api<ProductType>('/api/products', { method: 'POST', body: productData }),

  // Update an existing product
  updateProduct: (productId: string, productData: Partial<ProductType>) => 
    api<ProductType>(`/api/products/${productId}`, { method: 'PUT', body: productData }),

  // Delete a product
  deleteProduct: (productId: string) => 
    api<{ message: string; deletedProductId: string }>(`/api/products/${productId}`, { method: 'DELETE' }),

  // Validate a formula string
  validateFormula: (formula: string) => 
    api<{ valid: boolean; error?: string }>('/api/products/validate-formula', { method: 'POST', body: { formula } }),

  // Calculate product cost based on width and height
  calculateProductCost: (productId: string, width: number, height: number) => 
    api<ProductCostResult>('/api/products/calculate-cost', { 
      method: 'POST', 
      body: { productId, width, height } 
    }),

  // NEW: Glass formula management APIs
  getGlassFormula: (productId: string) => 
    api<GlassFormula>(`/api/products/${productId}/glass-formula`),

  updateGlassFormula: (productId: string, formula: GlassFormula) => 
    api<{ message: string; formula: GlassFormula }>(`/api/products/${productId}/glass-formula`, { 
      method: 'PUT', 
      body: formula 
    }),

  validateGlassFormula: (data: {
    widthFormula: string;
    heightFormula: string;
    glassQuantity: number;
    inputUnit: string;
    outputUnit: string;
    testDimensions?: { width: number; height: number };
  }) => 
    api<GlassFormulaValidationResult>('/api/products/validate-glass-formula', { 
      method: 'POST', 
      body: data 
    }),

  // NEW: SVG Technical Drawing APIs
  generateSVG: (productId: string, request: SVGGenerationRequest) => 
    api<SVGGenerationResponse>(`/api/products/${productId}/generate-svg`, { 
      method: 'POST', 
      body: request 
    }),

  updateTechnicalDrawing: (productId: string, request: SVGUpdateRequest) => 
    api<SVGGenerationResponse>(`/api/products/${productId}/technical-drawing`, { 
      method: 'PUT', 
      body: request 
    }),
}; 