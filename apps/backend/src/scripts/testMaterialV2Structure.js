const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aluminiumDB';
        await mongoose.connect(uri);
        console.log('[Test] Connected to MongoDB');
    } catch (error) {
        console.error('[Test] MongoDB connection error:', error);
        process.exit(1);
    }
};

const testMaterialV2Structure = async () => {
    try {
        const MaterialV2 = require('../models/MaterialV2');
        
        console.log('[Test] Testing Material V2 structure...\n');
        
        // Test existing materials
        const materials = await MaterialV2.find({}).limit(5);
        
        for (const material of materials) {
            console.log(`\n=== Testing Material: ${material.name} (${material.category}) ===`);
            
            // Test activeBatches virtual
            const activeBatches = material.activeBatches;
            console.log(`Active batches: ${activeBatches.length}`);
            
            // Test stock summary
            const stockSummary = material.getStockSummary();
            console.log(`Stock summary:`, Object.keys(stockSummary));
            
            // Test available batches
            const availableBatches = material.getAvailableBatches();
            console.log(`Available batches: ${availableBatches.length}`);
            
            // Check new structure exists
            if (material.category === 'Profile') {
                console.log(`Profile batches: ${material.profileBatches?.length || 0}`);
                console.log(`Simple batches: ${material.simpleBatches?.length || 0}`);
                
                if (material.profileBatches && material.profileBatches.length > 0) {
                    const firstBatch = material.profileBatches[0];
                    console.log(`First batch: Length=${firstBatch.length}, Gauge=${firstBatch.gauge}, Qty=${firstBatch.currentQuantity}`);
                }
            } else {
                console.log(`Profile batches: ${material.profileBatches?.length || 0}`);
                console.log(`Simple batches: ${material.simpleBatches?.length || 0}`);
                
                if (material.simpleBatches && material.simpleBatches.length > 0) {
                    const firstBatch = material.simpleBatches[0];
                    console.log(`First batch: Qty=${firstBatch.currentQuantity}, Rate=${firstBatch.ratePerUnit}`);
                }
            }
            
            // Check old structure (should be removed after migration)
            if (material.stockBatches && material.stockBatches.length > 0) {
                console.log(`⚠️  WARNING: Old stockBatches still present (${material.stockBatches.length} batches)`);
            } else {
                console.log(`✅ Migration completed - no old stockBatches`);
            }
            
            // Test aggregated totals
            console.log(`Total stock: ${material.aggregatedTotals.totalCurrentStock}`);
            console.log(`Total value: ${material.aggregatedTotals.totalCurrentValue}`);
        }
        
        console.log('\n[Test] Structure test completed successfully!');
        
    } catch (error) {
        console.error('[Test] Error during testing:', error);
        throw error;
    }
};

const main = async () => {
    try {
        await connectDB();
        await testMaterialV2Structure();
        console.log('[Test] All tests completed successfully!');
    } catch (error) {
        console.error('[Test] Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('[Test] Disconnected from MongoDB');
        process.exit(0);
    }
};

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { testMaterialV2Structure }; 