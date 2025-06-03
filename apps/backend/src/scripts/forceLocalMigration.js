const { MongoClient } = require('mongodb');

// Direct MongoDB migration script with forced localhost connection
const forceLocalMigration = async () => {
    let client;
    
    try {
        // Force localhost connection (ignore env variables)
        const uri = 'mongodb://localhost:27017/aluminiumDB';
        console.log(`[Force Migration] Connecting to: ${uri}`);
        
        client = new MongoClient(uri);
        await client.connect();
        
        const db = client.db();
        const collection = db.collection('materials_v2');
        
        console.log('[Force Migration] Connected to MongoDB');
        console.log('[Force Migration] Starting forced migration for ALL materials with stockBatches...');
        
        // Find ALL materials with stockBatches field (even if empty, but not null)
        const materialsWithStockBatches = await collection.find({
            stockBatches: { $exists: true }
        }).toArray();
        
        console.log(`[Force Migration] Found ${materialsWithStockBatches.length} materials with stockBatches field`);
        
        if (materialsWithStockBatches.length === 0) {
            console.log('[Force Migration] No materials found with stockBatches field. Checking all materials...');
            
            // Check what fields exist in materials
            const sampleMaterials = await collection.find({}).limit(3).toArray();
            console.log('[Force Migration] Sample materials structure:');
            sampleMaterials.forEach(material => {
                console.log(`  - ${material.name}: hasStockBatches=${!!material.stockBatches}, hasProfileBatches=${!!material.profileBatches}, hasSimpleBatches=${!!material.simpleBatches}`);
            });
            
            return;
        }
        
        let migrationCount = 0;
        
        for (const material of materialsWithStockBatches) {
            console.log(`\n[Force Migration] Processing: ${material.name} (${material.category})`);
            console.log(`  - stockBatches count: ${material.stockBatches?.length || 0}`);
            
            // Skip if no stockBatches to migrate
            if (!material.stockBatches || material.stockBatches.length === 0) {
                console.log(`  - Skipping: No stockBatches to migrate`);
                
                // Still ensure the new fields exist
                await collection.updateOne(
                    { _id: material._id },
                    {
                        $set: {
                            profileBatches: material.profileBatches || [],
                            simpleBatches: material.simpleBatches || []
                        },
                        $unset: { stockBatches: 1 }
                    }
                );
                continue;
            }
            
            const updateData = {};
            
            if (material.category === 'Profile') {
                // Migrate to profileBatches
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
                    isActive: batch.isActive !== false, // Default to true if undefined
                    isCompleted: batch.isCompleted || false,
                    lowStockThreshold: batch.lowStockThreshold
                }));
                updateData.simpleBatches = [];
            } else {
                // Migrate to simpleBatches
                updateData.simpleBatches = material.stockBatches.map(batch => ({
                    _id: batch._id,
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
                    isActive: batch.isActive !== false, // Default to true if undefined
                    isCompleted: batch.isCompleted || false,
                    lowStockThreshold: batch.lowStockThreshold
                }));
                updateData.profileBatches = [];
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
                console.log(`  ✅ Migrated: ${material.stockBatches.length} batches → ${material.category === 'Profile' ? 'profileBatches' : 'simpleBatches'}`);
            } else {
                console.log(`  ⚠️ No changes made to ${material.name}`);
            }
        }
        
        console.log(`\n[Force Migration] ✅ Migration completed successfully!`);
        console.log(`[Force Migration] Migrated ${migrationCount} materials`);
        
        // Verify the migration
        const remainingStockBatches = await collection.countDocuments({
            stockBatches: { $exists: true, $ne: [] }
        });
        
        const newFormatCount = await collection.countDocuments({
            $or: [
                { profileBatches: { $exists: true } },
                { simpleBatches: { $exists: true } }
            ]
        });
        
        console.log(`[Force Migration] Verification:`);
        console.log(`  - Materials with new format: ${newFormatCount}`);
        console.log(`  - Materials with old stockBatches remaining: ${remainingStockBatches}`);
        
        if (remainingStockBatches === 0) {
            console.log(`[Force Migration] 🎉 All materials successfully migrated!`);
        } else {
            console.log(`[Force Migration] ⚠️ ${remainingStockBatches} materials still need migration`);
        }
        
    } catch (error) {
        console.error('[Force Migration] ❌ Migration failed:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('[Force Migration] Disconnected from MongoDB');
        }
    }
};

// Run if called directly
if (require.main === module) {
    forceLocalMigration()
        .then(() => {
            console.log('[Force Migration] Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[Force Migration] Script failed:', error);
            process.exit(1);
        });
}

module.exports = { forceLocalMigration }; 