# Gauge Auto-Fill Debug and Testing Guide

## Issues Identified and Fixed

### 1. **Missing Gauge Field in Form Submission**
**Problem**: When saving the form, the gauge field was not being sent to the API.
**Root Cause**: In the edit page `handleSubmit` function, the `stockByLength` mapping was missing the `gauge` field.
**Fix**: Added `gauge: item.gauge || undefined` to the API data mapping.

```javascript
// Before (BROKEN)
stockByLength: formData.stockByLength.map((item: any) => {
  return {
    length: parseFloat(item.length),
    lengthUnit: unit, // Also wrong field name
    quantity: parseFloat(item.quantity),
    // Missing gauge field!
  };
}),

// After (FIXED)  
stockByLength: formData.stockByLength.map((item: any) => {
  return {
    length: parseFloat(item.length),
    unit: unit, // Correct field name
    gauge: item.gauge || undefined, // Added gauge field
    quantity: parseFloat(item.quantity),
  };
}),
```

### 2. **Unit Rate Not Saving to Database (CRITICAL FIX)**
**Problem**: Unit rates entered in the form were not being saved to the database.
**Root Cause**: Backend controller was directly copying request data without converting numeric fields to Decimal128 as required by the Material schema.
**Fix**: Added proper Decimal128 conversion in the `updateMaterial` controller.

```javascript
// Added to backend controller:
if (stockItem.unitRate !== undefined) {
    stockItem.unitRate = mongoose.Types.Decimal128.fromString(String(stockItem.unitRate));
    console.log(`[updateMaterial] Converting unitRate ${stockItem.unitRate} to Decimal128 for stock item`);
}
```

This fix also applies to:
- `quantity` field in stockByLength
- `lowStockThreshold` field in stockByLength  
- `length` field in stockByLength and standardLengths
- `weightPerUnitLength` field in gaugeSpecificWeights
- All numeric fields for non-Profile categories

**IMPORTANT**: This same fix was also applied to the `addMaterial` controller to ensure unit rates are saved correctly when creating new materials (not just when editing existing ones).

### 3. **Enhanced Auto-Fill Logic with Debugging**
**Problem**: Auto-fill wasn't working reliably and there was no way to debug why.
**Fix**: Added comprehensive logging to track the auto-fill process.

```javascript
// Added extensive logging to debug auto-fill behavior
useEffect(() => {
  console.log('[MaterialForm] Auto-fill useEffect triggered', {
    category: formData.category,
    gaugeWeightsLength: formData.gaugeSpecificWeights.length,
    stockByLengthLength: formData.stockByLength.length,
    gaugeWeights: formData.gaugeSpecificWeights,
    stockByLength: formData.stockByLength
  });
  // ... auto-fill logic with detailed logging
}, [formData.gaugeSpecificWeights.length, formData.gaugeSpecificWeights[0]?.gauge, formData.stockByLength.length]);
```

### 4. **Form Data Processing Debugging**
**Problem**: Couldn't tell if gauge data was being loaded correctly from the database.
**Fix**: Added logging to track data transformation from API to form.

## Test Material Created

Created a test material with proper gauge data:
- **Material ID**: `6838730336d0b60079862575`
- **Name**: 3Track Top
- **Category**: Profile
- **Gauge Weights**: 18G (0.240 kg/ft), 20G (0.200 kg/ft)
- **Stock Entries**: Two 15ft entries with different gauges (20G and 18G)

## Testing Instructions

### 1. **Test Gauge Display from Database**
1. Navigate to: `http://localhost:3000/dashboard/inventory`
2. Look for "3Track Top" material
3. **Expected**: Should show separate stock entries with gauges:
   - `15ft 20G: 1 pieces Rate: ₹1237.50/pc`
   - `15ft 18G: 1 pieces Rate: ₹1237.50/pc`

### 2. **Test Edit Form Loading**
1. Click "Edit" on the 3Track Top material
2. **Check Console Logs**: Look for:
   ```
   [MaterialForm] Processing initialData: {...}
   [MaterialForm] Stock by length with gauges: [...]
   ```
3. **Expected**: 
   - Gauge Specific Weights section should show 18G and 20G
   - Stock By Length section should show two entries with gauges pre-selected

### 3. **Test Auto-Fill for New Stock Entry**
1. In the edit form, click "Add Stock Entry"
2. **Check Console Logs**: Look for auto-fill useEffect logs
3. **Expected**: New stock entry should have gauge auto-filled with most common gauge (20G or 18G)

### 4. **Test Gauge Dropdown**
1. In any stock entry, the gauge field should be a dropdown (not text input)
2. **Expected Options**:
   - `Select gauge`
   - `18G (0.240 kg/ft)`
   - `20G (0.200 kg/ft)`

### 5. **Test Save and Persistence (UPDATED)**
1. Change a gauge selection and unit rate, then save the form
2. **Check Console Logs**: Look for submission and conversion logs:
   ```
   [MaterialForm] Stock by length data being submitted: [...]
   [EditMaterialPage] Processing stock entry: {...}
   [updateMaterial] Converting unitRate ... to Decimal128 for stock item
   [EditMaterialPage] apiData for update: {...}
   ```
3. **Check Database**: After saving, unit rates should be visible in the inventory list
4. **Expected**: Gauge should persist after save, unit rates should be saved and displayed

### 6. **Test Unit Rate Persistence (NEW)**
1. Enter unit rates like 1029.6, 891, 1287 in stock entries
2. Save the form and verify success message
3. Navigate back to inventory list
4. **Expected**: Unit rates should show in the inventory display
5. Edit the material again
6. **Expected**: Unit rates should be loaded correctly in the form

### 7. **Test New Material Creation (CRITICAL)**
1. Create a new Profile material with gauge weights and stock entries
2. Enter unit rates in stock entries (e.g., 643.5, 317, 442)
3. Save the new material
4. **Check Console Logs**: Look for conversion logs:
   ```
   [addMaterial] Converting unitRate ... to Decimal128 for stock item
   ```
5. **Check Database**: Unit rates should be saved correctly even on first creation
6. **Expected**: Unit rates should be properly saved and visible immediately after creation

## Debugging Console Logs

### **When Form Loads**
```
[MaterialForm] Processing initialData: {...}
[MaterialForm] Formatted data for form: {...}
[MaterialForm] Stock by length with gauges: [...]
[MaterialForm] Auto-fill useEffect triggered {...}
```

### **When Auto-Fill Triggers**
```
[MaterialForm] Entries without gauges: [...]
[MaterialForm] Default gauge to use: "18G"
[MaterialForm] Auto-filling gauge for stock entry: {...}
[MaterialForm] Updated stock with gauges: [...]
```

### **When Form Submits**
```
[MaterialForm] Form submit triggered
[MaterialForm] Current formData before validation: {...}
[MaterialForm] Stock by length data being submitted: [...]
[EditMaterialPage] Attempting to update with materialId: ...
[EditMaterialPage] apiData for update: {...}
```

## Expected Behavior After Fixes

### ✅ **Auto-Fill Working**
- Loading existing material with gauge weights → Stock entries show correct gauges
- Adding new stock entry → Auto-fills with most common or first available gauge
- Adding gauge weight → Empty stock entries get auto-filled

### ✅ **Gauge Persistence**
- Selecting gauge from dropdown → Selection stays selected
- Saving form → Gauge selection persists and doesn't reset
- Reloading edit form → Gauge shows correct value from database

### ✅ **Unit Rate Persistence (NEW)**
- Entering unit rates in stock entries → Values are accepted and displayed
- Saving form → Unit rates are converted to Decimal128 and saved to database
- Inventory list → Unit rates display correctly (e.g., "Rate: ₹1237.50/pc")
- Reloading edit form → Unit rates load correctly from database

### ✅ **UI Improvements**
- Gauge field shows dropdown when gauges available
- Dropdown shows gauge with weight info: "18G (0.240 kg/ft)"
- Falls back to text input when no gauges defined
- Logical section order: Standard Lengths → Gauge Weights → Stock Entries

## If Issues Persist

### **Check Browser Console**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for the debug logs mentioned above
4. Check for any error messages

### **Verify Database Data**
Run this command to check the material in database:
```bash
cd apps/backend
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/aluminium_app').then(async () => { const Material = mongoose.model('Material', new mongoose.Schema({}, { strict: false })); const material = await Material.findById('6838730336d0b60079862575'); console.log('Stock:', JSON.stringify(material.stockByLength, null, 2)); await mongoose.disconnect(); }).catch(console.error);"
```

### **Common Issues**
1. **Empty Database**: If no materials exist, create test material first
2. **Missing Gauge Field**: Check API submission logs for gauge field
3. **Auto-Fill Not Triggering**: Check useEffect dependencies and conditions
4. **Dropdown Not Showing**: Verify gaugeSpecificWeights array has data

The fixes should resolve the gauge auto-fill and persistence issues. All gauge-related functionality should now work as expected. 