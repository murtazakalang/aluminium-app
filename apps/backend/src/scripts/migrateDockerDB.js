const { MongoClient } = require('mongodb');

// Migration script specifically for Docker database
const migrateDockerDB = async () => {
    let client;
    
    try {
        // Connect to Docker MongoDB on localhost:27017
        const uri = 'mongodb://localhost:27017/aluminiumDB';
        console.log(`[Docker Migration] Connecting to: ${uri}`);
        
        client = new MongoClient(uri);
        await client.connect();
        
        const db = client.db('aluminiumDB'); // Explicitly specify database name
        const collection = db.collection('materials_v2');
        
        console.log('[Docker Migration] Connected to MongoDB');
        console.log('[Docker Migration] Database name:', db.databaseName);
        
        // Get total count first
        const totalMaterials = await collection.countDocuments({});
        console.log(`[Docker Migration] Total materials: ${totalMaterials}`);
        
        // Find materials with stockBatches - looking for the exact materials from your database
        const materialsWithStockBatches = await collection.find({
            stockBatches: { $exists: true, $ne: [] }
        }).toArray();
        
        console.log(`[Docker Migration] Found ${materialsWithStockBatches.length} materials with stockBatches`);
        
        // Show sample materials to verify we're in the right database
        const sampleMaterials = await collection.find({}).limit(3).toArray();
        console.log('\n[Docker Migration] Sample materials in database:');
        sampleMaterials.forEach(material => {
            console.log(`  - ${material.name} (${material.category})`);
            console.log(`    stockBatches: ${material.stockBatches ? material.stockBatches.length : 0}`);
        });
        
        if (materialsWithStockBatches.length === 0) {
            console.log('\n[Docker Migration] No materials need migration (already in new format or no data)');
            return;
        }
        
        console.log('\n[Docker Migration] Starting migration...');
        
        let migrationCount = 0;
        
        for (const material of materialsWithStockBatches) {
            console.log(`\n[Docker Migration] Migrating: ${material.name} (${material.category})`);
            console.log(`  - Has ${material.stockBatches.length} stock batches`);
            
            const updateData = {};
            
            if (material.category === 'Profile') {
                // Migrate Profile materials to profileBatches
                updateData.profileBatches = material.stockBatches.map(batch => ({
                    _id: batch._id,
                    batchId: batch.batchId,
                    length: batch.length,
                    lengthUnit: batch.lengthUnit,
                    gauge: batch.gauge,
                    originalQuantity: batch.originalQuantity,
                    currentQuantity: batch.currentQuantity,
                    actualTotalWeight: batch.actualTotalWeight,
                    actualWeightUnit: batch.actualWeightUnit || 'kg',
                    totalCostPaid: batch.totalCostPaid,
                    ratePerPiece: batch.ratePerPiece,
                    ratePerKg: batch.ratePerKg,
                    supplier: batch.supplier,
                    purchaseDate: batch.purchaseDate,
                    invoiceNumber: batch.invoiceNumber,
                    lotNumber: batch.lotNumber,
                    notes: batch.notes,
                    isActive: batch.isActive !== false,
                    isCompleted: batch.isCompleted || false,
                    lowStockThreshold: batch.lowStockThreshold
                }));
                updateData.simpleBatches = [];
                console.log(`    → Moving to profileBatches`);
            } else {
                // Migrate non-Profile materials to simpleBatches
                updateData.simpleBatches = material.stockBatches.map(batch => ({
                    _id: batch._id,
                    batchId: batch.batchId,
                    originalQuantity: batch.originalQuantity,
                    currentQuantity: batch.currentQuantity,
                    totalCostPaid: batch.totalCostPaid,
                    ratePerUnit: batch.ratePerPiece, // Map ratePerPiece to ratePerUnit
                    supplier: batch.supplier,
                    purchaseDate: batch.purchaseDate,
                    invoiceNumber: batch.invoiceNumber,
                    lotNumber: batch.lotNumber,
                    notes: batch.notes,
                    isActive: batch.isActive !== false,
                    isCompleted: batch.isCompleted || false,
                    lowStockThreshold: batch.lowStockThreshold
                }));
                updateData.profileBatches = [];
                console.log(`    → Moving to simpleBatches`);
            }
            
            // Perform the migration
            const result = await collection.updateOne(
                { _id: material._id },
                {
                    $set: updateData,
                    $unset: { stockBatches: 1 }
                }
            );
            
            if (result.modifiedCount > 0) {
                migrationCount++;
                console.log(`    ✅ Successfully migrated ${material.stockBatches.length} batches`);
            } else {
                console.log(`    ⚠️ No changes made`);
            }
        }
        
        console.log(`\n[Docker Migration] ✅ Migration completed!`);
        console.log(`[Docker Migration] Successfully migrated ${migrationCount} materials`);
        
        // Final verification
        const remaining = await collection.countDocuments({
            stockBatches: { $exists: true, $ne: [] }
        });
        
        const withNewFormat = await collection.countDocuments({
            $or: [
                { profileBatches: { $exists: true } },
                { simpleBatches: { $exists: true } }
            ]
        });
        
        console.log(`\n[Docker Migration] Final verification:`);
        console.log(`  - Materials with new format: ${withNewFormat}`);
        console.log(`  - Materials with old stockBatches remaining: ${remaining}`);
        
        if (remaining === 0) {
            console.log(`\n🎉 All materials successfully migrated to new structure!`);
        }
        
    } catch (error) {
        console.error('[Docker Migration] ❌ Migration failed:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('[Docker Migration] Disconnected from MongoDB');
        }
    }
};

// Run migration
if (require.main === module) {
    migrateDockerDB()
        .then(() => {
            console.log('[Docker Migration] Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[Docker Migration] Script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateDockerDB }; 