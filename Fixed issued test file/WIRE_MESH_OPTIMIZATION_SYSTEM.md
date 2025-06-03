# Wire Mesh Optimization System

## Overview

Wire Mesh materials require **width-based optimization** similar to how Profile materials use length optimization. This system handles standard widths, automatic width selection, and wastage calculation for optimal material usage.

## Problem Solved

### Traditional Issue:
```yaml
Problem Example:
  Required: 1.25ft width × 5ft length = 6.25 sqft
  Available: 2ft width × 5ft length = 10 sqft
  Wastage: 0.75ft × 5ft = 3.75 sqft (37.5% waste!)
  
Current System Issues:
  - No width optimization
  - No standard width tracking  
  - No wastage calculation
  - Manual material planning
```

### New Solution:
```yaml
Wire Mesh Optimization:
  - Standard widths: 2ft, 2.5ft, 3ft, 3.5ft, 4ft, 5ft, 6ft
  - Automatic width selection for minimal waste
  - Precise wastage calculation
  - Formula integration for accurate costing
```

## System Architecture

### 1. **Material Creation with Standard Widths**

```typescript
// Wire Mesh material with standard widths
{
  name: "Mosquito Wire Mesh",
  category: "Wire Mesh",
  stockUnit: "sqft",
  usageUnit: "sqft",
  standardWidths: [
    { width: "2", unit: "ft" },
    { width: "2.5", unit: "ft" },
    { width: "3", unit: "ft" },
    { width: "3.5", unit: "ft" },
    { width: "4", unit: "ft" },
    { width: "5", unit: "ft" },
    { width: "6", unit: "ft" }
  ]
}
```

### 2. **Width Optimization Algorithm**

```javascript
// Example optimization logic
function findOptimalWidth(requiredWidth, standardWidths) {
  // Find smallest standard width that can accommodate requirement
  const suitableWidths = standardWidths.filter(w => w.width >= requiredWidth);
  return suitableWidths.length > 0 
    ? suitableWidths.reduce((min, current) => 
        current.width < min.width ? current : min)
    : null;
}

// Usage example:
const requiredWidth = 1.25; // ft
const optimalWidth = findOptimalWidth(requiredWidth, standardWidths);
// Result: { width: 2, unit: "ft" }
```

### 3. **Wastage Calculation**

```javascript
// Calculate wastage for wire mesh
function calculateWireMeshWastage(requiredWidth, requiredLength, selectedWidth) {
  const requiredArea = requiredWidth * requiredLength;
  const usedArea = selectedWidth * requiredLength;
  const wastageArea = usedArea - requiredArea;
  const wastagePercentage = (wastageArea / usedArea) * 100;
  
  return {
    requiredArea,    // 6.25 sqft
    usedArea,        // 10 sqft  
    wastageArea,     // 3.75 sqft
    wastagePercentage // 37.5%
  };
}
```

## Product Formula Integration

### 1. **Formula Definition for Wire Mesh**

```yaml
Window Formula Example:
  Wire Mesh Component:
    material: "Mosquito Wire Mesh"
    requiredWidth: "window.width + 0.1"  # Add 0.1ft margin
    requiredLength: "window.height + 0.1" # Add 0.1ft margin
    optimization: "width_based"
    
  Calculation Process:
    1. Calculate required dimensions
    2. Find optimal standard width
    3. Calculate total area needed
    4. Calculate wastage
    5. Update material consumption
```

### 2. **Formula Usage Example**

```javascript
// Window: 3.5ft × 4ft needs wire mesh
const windowWidth = 3.5;  // ft
const windowHeight = 4;   // ft
const margin = 0.1;       // ft

// Required dimensions
const requiredWidth = windowWidth + margin;  // 3.6ft
const requiredLength = windowHeight + margin; // 4.1ft

// System finds optimal width: 4ft (next available size)
const optimalWidth = 4; // ft
const actualArea = optimalWidth * requiredLength; // 16.4 sqft
const requiredArea = requiredWidth * requiredLength; // 14.76 sqft
const wastage = actualArea - requiredArea; // 1.64 sqft (10% waste)
```

## Benefits

### 🎯 **Optimized Material Usage**
- Automatic selection of best standard width
- Minimal wastage through smart optimization
- Accurate material quantity calculation

### 📊 **Accurate Costing**
- Precise wastage calculation in formulas
- Real material consumption tracking
- Better project cost estimation

### ⚡ **Streamlined Operations**
- Automated width selection
- Standard width inventory management
- Simplified purchasing decisions

### 📈 **Better Planning**
- Standard width inventory tracking
- Wastage analysis and reporting
- Material efficiency insights

## Implementation Status

### ✅ **Completed Features**
- [x] Wire Mesh category added to creation form
- [x] Standard widths configuration UI
- [x] Common width presets (2ft, 2.5ft, 3ft, etc.)
- [x] Backend API support for standardWidths
- [x] Database schema updated
- [x] Usage unit fixed (sqft instead of pcs)
- [x] **Wire Mesh Optimization Service** - Core width optimization logic
- [x] **Formula Integration** - Product/estimation services integrated
- [x] **API Testing Endpoints** - Test optimization and analysis
- [x] **ProductType Schema Updated** - Wire Mesh support
- [x] **Width-based wastage calculation** - Automatic optimization

### 🚧 **Next Steps**
- [ ] Frontend Wire Mesh optimization dashboard
- [ ] Advanced reporting for material efficiency
- [ ] Inventory tracking by width sizes
- [ ] Bulk Wire Mesh operations

## Usage Guide

### 1. **Creating Wire Mesh Materials**
1. Click "Create Hardware & Glass" button
2. Select "Wire Mesh" category
3. Set stock unit (sqft/sqm) and usage unit (sqft/sqm)
4. Configure standard widths:
   - Use "Common Widths" for standard sizes
   - Or manually add custom widths
5. Set price per unit for initial costing
6. Save material

### 2. **Using in Product Formulas** ⭐ **NEW - IMPLEMENTED**
```yaml
ProductType Configuration:
  materials:
    - materialId: "wire_mesh_material_id"
      materialCategorySnapshot: "Wire Mesh"
      # IMPORTANT: Wire Mesh requires exactly 2 formulas
      formulas: 
        - "W + 0.1"  # Width formula (window width + margin)
        - "H + 0.1"  # Length formula (window height + margin)
      formulaInputUnit: "ft"
      quantityUnit: "sqft"
      isCutRequired: false
```

**Formula Rules for Wire Mesh:**
- **Exactly 2 formulas required**: `[width_formula, length_formula]`
- **Width formula** (index 0): Calculates required width
- **Length formula** (index 1): Calculates required length
- System automatically finds optimal standard width
- Calculates actual area including wastage

### 3. **API Testing Endpoints** ⭐ **NEW - IMPLEMENTED**

#### Test Width Optimization
```javascript
POST /api/v2/inventory/wire-mesh/test-optimization
{
  "materialId": "material_id",
  "requiredWidth": 1.25,
  "requiredLength": 5,
  "dimensionUnit": "ft"
}

// Response includes optimization details:
{
  "optimization": {
    "requiredWidth": 1.25,
    "requiredLength": 5,
    "selectedWidth": 2,        // Next available standard width
    "actualArea": 10,          // 2ft × 5ft
    "wastageArea": 3.75,       // 0.75ft × 5ft
    "wastagePercentage": 37.5,
    "efficiency": 62.5
  }
}
```

#### Calculate for Window
```javascript
POST /api/v2/inventory/wire-mesh/calculate-window
{
  "materialId": "material_id",
  "windowWidth": 3.5,
  "windowHeight": 4,
  "margin": 0.1,
  "quantity": 5
}

// Calculates optimized area for multiple windows
```

### 4. **Formula Integration in Action**

When a product uses Wire Mesh:

1. **Formula Evaluation**: Width and length formulas evaluated separately
2. **Width Optimization**: System finds smallest suitable standard width
3. **Area Calculation**: Actual area = selected_width × required_length
4. **Wastage Tracking**: Precise wastage calculation and reporting
5. **Cost Calculation**: Based on actual area (including wastage)

**Example: 3.5ft × 4ft Window**
```yaml
Input: Window 3.5ft × 4ft with 0.1ft margin
Formulas: ["W + 0.1", "H + 0.1"]
Required: 3.6ft width × 4.1ft length = 14.76 sqft
Optimal: 4ft standard width (next available)
Actual: 4ft × 4.1ft = 16.4 sqft
Wastage: 1.64 sqft (10% waste)
Efficiency: 90%
```

### 5. **Integration Points** ⭐ **NEW**

#### ProductService Integration
- `calculateProductCost()` - Handles Wire Mesh with optimization
- Separate Wire Mesh processing path
- Includes optimization details in response

#### EstimationService Integration  
- `calculateEstimationMaterials()` - Full Wire Mesh support
- Width optimization per item
- Aggregated wastage tracking
- Auto-rate detection

#### Backend Services
- `WireMeshOptimizationService` - Core optimization logic
- `MaterialV2` model - Standard widths storage
- API controllers for testing and analysis

## Technical Details

### Updated Database Structure
```javascript
{
  name: "Mosquito Wire Mesh",
  category: "Wire Mesh",
  standardLengths: [ // Reused field for widths
    { length: Decimal("2"), unit: "ft" },
    { length: Decimal("2.5"), unit: "ft" },
    { length: Decimal("3"), unit: "ft" },
    { length: Decimal("3.5"), unit: "ft" },
    { length: Decimal("4"), unit: "ft" },
    { length: Decimal("5"), unit: "ft" },
    { length: Decimal("6"), unit: "ft" }
  ]
}
```

### API Endpoints ⭐ **NEW**
- `POST /api/v2/inventory/create-simplified-material` - Create with standardWidths
- `POST /api/v2/inventory/wire-mesh/test-optimization` - Test optimization
- `GET /api/v2/inventory/wire-mesh/:id/efficiency` - Efficiency analysis  
- `POST /api/v2/inventory/wire-mesh/calculate-window` - Window calculations

### Service Architecture
```javascript
WireMeshOptimizationService
├── findOptimalWidth()           // Core width selection logic
├── calculateWireMeshConsumption() // Area and wastage calculation  
├── processWireMeshFormula()     // Formula integration
└── analyzeWireMeshEfficiency()  // Performance analysis

ProductService
├── calculateProductCost()       // Wire Mesh integration
└── Material processing with optimization

EstimationService  
├── calculateEstimationMaterials() // Wire Mesh support
└── Aggregated optimization tracking
```

This system provides a complete solution for Wire Mesh optimization, reducing material waste and improving cost accuracy in aluminium window manufacturing. 