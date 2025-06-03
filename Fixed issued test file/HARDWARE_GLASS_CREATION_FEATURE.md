# Hardware & Glass Material Creation Feature

## Overview

A new specialized form has been added to create Hardware, Glass, Wire Mesh, Accessories, and Consumables materials with a streamlined interface that's tailored specifically for these non-Profile material categories.

## Features

### 🎯 **Category-Specific Interface**
- **Glass**: Glass panels, sheets, and glazing materials
- **Hardware**: Fasteners, handles, locks, and mechanical components  
- **Wire Mesh**: Wire mesh, security grills, and screening materials *(NEW)*
- **Accessories**: Supporting materials and accessories
- **Consumables**: Consumable materials and supplies

### 🚀 **Streamlined Creation Process**
- Simple, clean interface without unnecessary Profile-specific fields
- Category-appropriate stock unit suggestions
- Automatic usage unit configuration based on category and general settings
- Real-time examples and descriptions for each category
- **Initial pricing option** - Set price per unit during creation *(NEW)*

### 🔧 **Smart Defaults**
- **Glass**: Stock units include sqft, sqm, piece; Usage units auto-set from general settings (area unit)
- **Hardware**: Stock units include piece, kg, box, set; Usage units set to pieces
- **Wire Mesh**: Stock units include sqft, sqm, meter, roll; Usage units auto-set from general settings (area unit) *(NEW)*
- **Accessories**: Stock units include piece, meter, roll, box; Usage units set to pieces
- **Consumables**: Stock units include piece, kg, liter, box; Usage units set to pieces

### 💰 **Initial Pricing Feature** *(NEW)*
- Optional "Price per Unit" field during material creation
- Set initial pricing without needing to create stock batches
- Materials can be used immediately in estimations
- Price is stored as the average rate per piece for the material

## How to Access

### From Batch Inventory Dashboard
1. Navigate to **Inventory Management** → **Batch Inventory**
2. In the **Quick Actions** section, click **🔧 Create Hardware & Glass**
3. The specialized creation form will open

### Button Location
The new button is prominently displayed in the Quick Actions section alongside:
- 📦 Stock Inward
- ⚙️ Create Profile Material (for pipes/profiles)
- 🔧 **Create Hardware & Glass** (UPDATED with Wire Mesh)
- 📤 Consume Stock

## Using the Form

### Step 1: Select Category
- Choose from 5 category buttons with icons and descriptions *(Updated from 4)*
- **Wire Mesh** category includes examples: 'Mosquito Mesh', 'Security Mesh', 'Fly Screen', 'Stainless Steel Mesh'
- Each category shows relevant examples and appropriate stock units
- Category selection automatically updates stock unit options and usage units

### Step 2: Fill Material Details
- **Material Name**: Required field with category-appropriate placeholder
- **Stock Unit**: Dropdown with category-specific options
- **Usage Unit**: Auto-set based on category and general settings
- **Price per Unit**: NEW - Optional initial pricing field *(per stock unit)*
- **Supplier**: Optional supplier information
- **Brand**: Optional brand information
- **HSN Code**: Optional tax classification code
- **Description**: Optional detailed description

### Step 3: Submit
- Form validates required fields
- Creates material using the simplified Material V2 API
- Shows success message with pricing confirmation if provided
- Automatically returns to dashboard

## Examples

### Creating Wire Mesh Material *(NEW)*
```
Category: Wire Mesh
Name: Mosquito Mesh 18x16
Stock Unit: sqft (selected from sqft, sqm, meter, roll)
Usage Unit: sqft (auto-set from general settings)
Price per Unit: ₹45.00 (optional)
Supplier: Phifer
Brand: Phifer TuffScreen
HSN Code: 76142000
Description: Standard 18x16 mesh fiberglass mosquito screen
```

### Creating Glass Material with Pricing
```
Category: Glass
Name: 5mm Clear Glass
Stock Unit: sqft (selected from sqft, sqm, piece)
Usage Unit: sqft (auto-set from general settings)
Price per Unit: ₹85.00 (optional)
Supplier: Guardian Glass
Brand: Guardian
HSN Code: 70051000
Description: Standard clear float glass for windows
```

### Creating Hardware Material
```
Category: Hardware  
Name: SS Window Handle
Stock Unit: piece (selected from piece, kg, box, set)
Usage Unit: pcs (auto-set)
Price per Unit: ₹250.00 (optional)
Supplier: Dorma
Brand: Dorma
HSN Code: 83024900
Description: Stainless steel window handle with key lock
```

## Technical Implementation

### Backend Integration
- Uses updated `batchInventoryApi.createSimplifiedMaterial()` endpoint
- Supports `initialPricePerUnit` parameter for setting initial pricing
- Sends empty arrays for Profile-specific fields (standardLengths, gauges)
- Compatible with new Material V2 batch structure
- **Wire Mesh** category added to backend enum validation

### Database Storage
- Materials created with `simpleBatches: []` array (ready for stock)
- Initial pricing stored in `aggregatedTotals.averageRatePerPiece`
- No `profileBatches` or legacy `stockBatches` fields
- Clean structure with no irrelevant null fields
- Includes supplier, brand, hsnCode, description fields

### Frontend Architecture
- **Component**: `HardwareGlassCreationForm.tsx`
- **Integration**: Added to `BatchInventoryDashboard.tsx`
- **Modal-based**: Uses Dialog component for clean UX
- **Responsive**: Works on desktop and mobile
- **Updated grid**: 5 categories in responsive grid layout

## Benefits

### 🎯 **User Experience**
- Simplified interface without confusing Profile-specific fields
- Category-appropriate guidance and examples
- Faster material creation for non-Profile items
- **Immediate usability** with optional pricing

### 🛠 **Developer Benefits**
- Clean separation of concerns
- Reusable component architecture
- Consistent with existing patterns
- **Extended type safety** with Wire Mesh category

### 📊 **Database Efficiency**
- No null fields in database
- Optimized storage structure
- Better query performance
- **Initial pricing support** without batch creation

### 💰 **Business Benefits** *(NEW)*
- Materials can be used in estimations immediately
- No need to create stock batches just for pricing
- Faster workflow for quote generation
- Cleaner inventory setup process

## Next Steps After Creation

1. **Use Immediately**: With pricing set, material is ready for estimations
2. **Add Stock**: Use "Stock Inward" to add initial inventory (optional)
3. **Track Consumption**: Monitor usage through batch tracking system
4. **Update Pricing**: Rates can be updated through stock inward or direct editing

## Migration Notes

This feature works seamlessly with the new Material V2 batch structure:
- **Profile materials**: Use `profileBatches[]` with length, gauge, weight tracking
- **Non-Profile materials**: Use `simpleBatches[]` with quantity and rate tracking
- **Wire Mesh**: Treated as non-Profile with area-based measurements
- **Backward compatibility**: Legacy materials are automatically migrated

## Integration Points

### With Estimation System
- Created materials immediately available in material selection
- Initial pricing enables instant cost calculations
- Proper unit conversions based on usage units
- **Wire Mesh** materials work with area-based estimations

### With Stock Management
- Materials ready for stock inward operations
- Batch tracking for all inventory movements (when stock is added)
- Low stock alerts and reporting
- **Pre-pricing** eliminates batch creation for rate setup

### With Reporting
- Included in inventory valuation reports
- Usage tracking and consumption reports
- Supplier and category analysis
- **Wire Mesh** category included in all reports

---

**Status**: ✅ **COMPLETED & TESTED**
**Version**: Material V2 Compatible + Wire Mesh + Initial Pricing
**Integration**: Batch Inventory Dashboard 