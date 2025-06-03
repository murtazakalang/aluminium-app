# Stock Management System Redesign

## **Current Problems**
1. **Weight Calculation Confusion**: Calculated weights don't match actual received weights
2. **Retroactive Updates**: New stock changes affect existing stock calculations
3. **Complex Unit Management**: Weight-based vs piece-based rate conversions are confusing
4. **Poor Batch Tracking**: No clear separation of different purchase batches
5. **Manufacturing Accuracy**: Cutting plans need exact weights, not calculated estimates

## **Recommended Solution: Batch-Level Stock Tracking**

### **Core Principles**
1. **Each stock inward = Separate batch entry**
2. **Actual weights always preserved**
3. **No retroactive weight calculations**
4. **Simple rate management**
5. **Clear manufacturing data**

### **New Schema Design**

```javascript
// Material Schema - Simplified
const materialSchema = new mongoose.Schema({
    // Basic info
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    category: { type: String, enum: ['Profile', 'Glass', 'Hardware', 'Accessories', 'Consumables'], required: true },
    
    // Units
    stockUnit: { type: String, required: true }, // 'piece', 'kg', 'sqft', etc.
    usageUnit: { type: String, required: true }, // How it's used in quotations
    
    // Profile-specific
    standardLengths: [{ 
        length: { type: mongoose.Types.Decimal128, required: true },
        unit: { type: String, required: true, default: 'ft' }
    }],
    
    // Reference gauge weights (for quotation calculations only)
    referenceGaugeWeights: [{
        gauge: { type: String, required: true },
        referenceWeight: { type: mongoose.Types.Decimal128, required: true }, // kg per ft
        unitLength: { type: String, default: 'ft' }
    }],
    
    // Stock batches - each inward creates a new batch
    stockBatches: [{
        batchId: { type: String, required: true }, // Auto-generated: "BATCH_YYYYMMDD_XXX"
        length: { type: mongoose.Types.Decimal128, required: true },
        lengthUnit: { type: String, required: true },
        gauge: { type: String }, // For profiles
        
        // Stock tracking
        originalQuantity: { type: mongoose.Types.Decimal128, required: true }, // Initial quantity
        currentQuantity: { type: mongoose.Types.Decimal128, required: true }, // Current available
        
        // Weight and cost (as provided during inward)
        actualTotalWeight: { type: mongoose.Types.Decimal128 }, // Actual weighed amount
        actualWeightUnit: { type: String, default: 'kg' },
        totalCostPaid: { type: mongoose.Types.Decimal128, required: true },
        
        // Calculated rates (for reference)
        ratePerPiece: { type: mongoose.Types.Decimal128, required: true },
        ratePerKg: { type: mongoose.Types.Decimal128 }, // If weight provided
        
        // Batch metadata
        supplier: String,
        purchaseDate: { type: Date, default: Date.now },
        invoiceNumber: String,
        notes: String,
        
        isActive: { type: Boolean, default: true }
    }],
    
    // Aggregated totals (calculated from active batches)
    totalCurrentStock: { type: mongoose.Types.Decimal128, default: '0' }, // In pieces/stockUnit
    totalCurrentWeight: { type: mongoose.Types.Decimal128, default: '0' }, // In kg
    averageRatePerUnit: { type: mongoose.Types.Decimal128, default: '0' },
    
    // Other fields...
    supplier: String,
    brand: String,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
```

### **Key Benefits of This Approach**

#### **1. Clear Batch Separation**
- Each stock inward creates a unique batch entry
- No mixing of different purchase weights/rates
- Clear traceability for accounting
- Easy to identify which batch material came from

#### **2. Actual Weight Preservation**
- Store exactly what was received and weighed
- No calculated weights that don't match reality
- Manufacturing gets exact weights for cutting plans
- No retroactive weight changes

#### **3. Simplified Rate Management**
- Store rate per piece (calculated from total cost ÷ pieces)
- Store rate per kg (if weight provided)
- No complex unit conversions during entry
- Rates never change retroactively

#### **4. Manufacturing Accuracy**
- Each batch has exact weight information
- Cutting plans can use actual weights
- No confusion about calculated vs actual weights
- Better material utilization

### **Implementation Plan**

#### **Phase 1: New Schema & Migration**
1. Create new Material schema with batch structure
2. Migrate existing data to batch format
3. Preserve all existing actual weights
4. Create migration script for smooth transition

#### **Phase 2: Updated Stock Inward Process**
```javascript
// Simplified stock inward
async function recordStockInward(companyId, userId, data) {
    const {
        materialId,
        length, lengthUnit, gauge,
        quantity, actualWeight, actualWeightUnit,
        totalCost, supplier, invoiceNumber
    } = data;
    
    const material = await Material.findById(materialId);
    
    // Generate unique batch ID
    const batchId = generateBatchId(); // e.g., "BATCH_20241201_001"
    
    // Calculate rates
    const ratePerPiece = totalCost / quantity;
    const ratePerKg = actualWeight ? (totalCost / actualWeight) : null;
    
    // Create new batch entry
    const newBatch = {
        batchId,
        length: mongoose.Types.Decimal128.fromString(String(length)),
        lengthUnit,
        gauge,
        originalQuantity: mongoose.Types.Decimal128.fromString(String(quantity)),
        currentQuantity: mongoose.Types.Decimal128.fromString(String(quantity)),
        actualTotalWeight: actualWeight ? mongoose.Types.Decimal128.fromString(String(actualWeight)) : null,
        actualWeightUnit,
        totalCostPaid: mongoose.Types.Decimal128.fromString(String(totalCost)),
        ratePerPiece: mongoose.Types.Decimal128.fromString(String(ratePerPiece)),
        ratePerKg: ratePerKg ? mongoose.Types.Decimal128.fromString(String(ratePerKg)) : null,
        supplier,
        invoiceNumber,
        purchaseDate: new Date()
    };
    
    material.stockBatches.push(newBatch);
    
    // Update aggregated totals
    await updateAggregatedTotals(material);
    
    await material.save();
    return { material, batchId };
}
```

#### **Phase 3: Stock Consumption (FIFO/LIFO)**
```javascript
// When material is used in production
async function consumeStock(materialId, quantityNeeded, length, gauge) {
    const material = await Material.findById(materialId);
    
    // Find matching batches (FIFO - oldest first)
    const availableBatches = material.stockBatches
        .filter(batch => 
            batch.isActive && 
            batch.length.toString() === String(length) &&
            batch.gauge === gauge &&
            parseFloat(batch.currentQuantity.toString()) > 0
        )
        .sort((a, b) => a.purchaseDate - b.purchaseDate);
    
    let remainingToConsume = quantityNeeded;
    const consumedBatches = [];
    
    for (const batch of availableBatches) {
        if (remainingToConsume <= 0) break;
        
        const available = parseFloat(batch.currentQuantity.toString());
        const toConsume = Math.min(remainingToConsume, available);
        
        batch.currentQuantity = mongoose.Types.Decimal128.fromString(
            String(available - toConsume)
        );
        
        consumedBatches.push({
            batchId: batch.batchId,
            quantityConsumed: toConsume,
            actualWeightConsumed: batch.actualTotalWeight ? 
                (parseFloat(batch.actualTotalWeight.toString()) * toConsume / parseFloat(batch.originalQuantity.toString())) : null
        });
        
        remainingToConsume -= toConsume;
    }
    
    await updateAggregatedTotals(material);
    await material.save();
    
    return consumedBatches;
}
```

### **User Interface Changes**

#### **1. Stock Inward Form - Simplified**
```jsx
// Much simpler form
<form>
    <MaterialSelect />
    <LengthInput />
    <GaugeSelect />
    <QuantityInput label="Number of Pieces" />
    <WeightInput label="Actual Total Weight (Optional)" />
    <CostInput label="Total Cost Paid" />
    <SupplierInput />
    <InvoiceNumberInput />
    
    {/* Calculated fields (read-only) */}
    <div className="calculated-fields">
        <div>Rate per piece: ₹{calculateRatePerPiece()}</div>
        {actualWeight && <div>Rate per kg: ₹{calculateRatePerKg()}</div>}
    </div>
</form>
```

#### **2. Stock View - Batch Detail**
```jsx
// Show stock by batches
<div className="stock-batches">
    {material.stockBatches.map(batch => (
        <BatchCard key={batch.batchId}>
            <div>Batch: {batch.batchId}</div>
            <div>{batch.currentQuantity}/{batch.originalQuantity} pieces</div>
            <div>Length: {batch.length}{batch.lengthUnit}</div>
            <div>Gauge: {batch.gauge}</div>
            <div>Actual Weight: {batch.actualTotalWeight}kg</div>
            <div>Rate: ₹{batch.ratePerPiece}/piece</div>
            <div>Supplier: {batch.supplier}</div>
            <div>Date: {batch.purchaseDate}</div>
        </BatchCard>
    ))}
</div>
```

### **Migration Strategy**

1. **Create migration script** to convert existing `stockByLength` to `stockBatches`
2. **Preserve all actual weights** from existing entries
3. **Create single batch per existing stock entry**
4. **Maintain backward compatibility** during transition
5. **Update all dependent services** (quotation, cutting plans, etc.)

### **Benefits for Manufacturing**

1. **Exact Weight Data**: Each batch shows exact received weight
2. **Batch Traceability**: Know which supplier/date material came from
3. **No Weight Confusion**: Actual weights never change
4. **Better Planning**: Use real weights for cutting plans
5. **Quality Control**: Track material performance by supplier/batch

This approach eliminates the complexity while providing better accuracy and traceability for a manufacturing business. 