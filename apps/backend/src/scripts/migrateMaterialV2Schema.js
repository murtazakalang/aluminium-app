const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aluminiumDB';
        await mongoose.connect(uri);
        console.log('[Migration] Connected to MongoDB');
    } catch (error) {
        console.error('[Migration] MongoDB connection error:', error);
        process.exit(1);
    }
};

const migrateMaterialV2Schema = async () => {
    try {
        console.log('[Migration] Starting Material V2 schema migration...');
        
        // Find ALL materials with stockBatches field (regardless of migration status)
        const materialsToMigrate = await mongoose.connection.collection('materials_v2').find({
            stockBatches: { $exists: true, $ne: [] }
        }).toArray();
        
        console.log(`[Migration] Found ${materialsToMigrate.length} materials to migrate`);
        
        for (const material of materialsToMigrate) {
            console.log(`[Migration] Migrating: ${material.name} (${material.category})`);
            
            const updateData = {};
            
            if (material.category === 'Profile') {
                // Migrate to profileBatches
                updateData.profileBatches = material.stockBatches.map(batch => ({
                    batchId: batch.batchId,
                    length: batch.length,
                    lengthUnit: batch.lengthUnit,
                    gauge: batch.gauge,
                    originalQuantity: batch.originalQuantity,
                    currentQuantity: batch.currentQuantity,
                    actualTotalWeight: batch.actualTotalWeight,
                    actualWeightUnit: batch.actualWeightUnit,
                    totalCostPaid: batch.totalCostPaid,
                    ratePerPiece: batch.ratePerPiece,
                    ratePerKg: batch.ratePerKg,
                    supplier: batch.supplier,
                    purchaseDate: batch.purchaseDate,
                    invoiceNumber: batch.invoiceNumber,
                    lotNumber: batch.lotNumber,
                    notes: batch.notes,
                    isActive: batch.isActive,
                    isCompleted: batch.isCompleted,
                    lowStockThreshold: batch.lowStockThreshold,
                    _id: batch._id
                }));
                updateData.simpleBatches = [];
            } else {
                // Migrate to simpleBatches  
                updateData.simpleBatches = material.stockBatches.map(batch => ({
                    batchId: batch.batchId,
                    originalQuantity: batch.originalQuantity,
                    currentQuantity: batch.currentQuantity,
                    totalCostPaid: batch.totalCostPaid,
                    ratePerUnit: batch.ratePerPiece, // Map ratePerPiece to ratePerUnit for non-profiles
                    supplier: batch.supplier,
                    purchaseDate: batch.purchaseDate,
                    invoiceNumber: batch.invoiceNumber,
                    lotNumber: batch.lotNumber,
                    notes: batch.notes,
                    isActive: batch.isActive,
                    isCompleted: batch.isCompleted,
                    lowStockThreshold: batch.lowStockThreshold,
                    _id: batch._id
                }));
                updateData.profileBatches = [];
            }
            
            // Remove the old stockBatches field and add new structure
            const result = await mongoose.connection.collection('materials_v2').updateOne(
                { _id: material._id },
                {
                    $set: updateData,
                    $unset: { stockBatches: 1 }
                }
            );
            
            if (result.modifiedCount > 0) {
                console.log(`[Migration] ✓ Migrated ${material.name}: ${material.stockBatches.length} batches to ${material.category === 'Profile' ? 'profileBatches' : 'simpleBatches'}`);
            } else {
                console.log(`[Migration] ⚠️ No changes made to ${material.name}`);
            }
        }
        
        console.log('[Migration] Schema migration completed successfully!');
        
        // Verify migration
        const newFormatCount = await mongoose.connection.collection('materials_v2').countDocuments({
            $or: [
                { profileBatches: { $exists: true } },
                { simpleBatches: { $exists: true } }
            ]
        });
        
        const oldFormatCount = await mongoose.connection.collection('materials_v2').countDocuments({
            stockBatches: { $exists: true, $ne: [] }
        });
        
        console.log(`[Migration] Verification: ${newFormatCount} materials with new format, ${oldFormatCount} materials with old format remaining`);
        
    } catch (error) {
        console.error('[Migration] Error during migration:', error);
        throw error;
    }
};

const main = async () => {
    try {
        await connectDB();
        await migrateMaterialV2Schema();
        console.log('[Migration] All migrations completed successfully!');
    } catch (error) {
        console.error('[Migration] Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('[Migration] Disconnected from MongoDB');
        process.exit(0);
    }
};

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { migrateMaterialV2Schema }; 