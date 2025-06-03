const { MongoClient } = require('mongodb');
require('dotenv').config();

const diagnosticDBCheck = async () => {
    let client;
    
    try {
        // Connect directly to MongoDB
        const uri = process.env.MONGO_URI || 'mongodb://mongo:27017/aluminiumDB';
        console.log(`[Diagnostic] Connecting to: ${uri}`);
        
        client = new MongoClient(uri);
        await client.connect();
        
        const db = client.db();
        const collection = db.collection('materials_v2');
        
        console.log('[Diagnostic] Connected to MongoDB');
        console.log('[Diagnostic] Database name:', db.databaseName);
        
        // Get total count of materials
        const totalMaterials = await collection.countDocuments({});
        console.log(`[Diagnostic] Total materials in collection: ${totalMaterials}`);
        
        // Check materials with different field structures
        const materialsWithStockBatches = await collection.countDocuments({
            stockBatches: { $exists: true }
        });
        
        const materialsWithNonEmptyStockBatches = await collection.countDocuments({
            stockBatches: { $exists: true, $ne: [] }
        });
        
        const materialsWithProfileBatches = await collection.countDocuments({
            profileBatches: { $exists: true }
        });
        
        const materialsWithSimpleBatches = await collection.countDocuments({
            simpleBatches: { $exists: true }
        });
        
        console.log(`[Diagnostic] Field structure breakdown:`);
        console.log(`  - Materials with stockBatches field: ${materialsWithStockBatches}`);
        console.log(`  - Materials with non-empty stockBatches: ${materialsWithNonEmptyStockBatches}`);
        console.log(`  - Materials with profileBatches field: ${materialsWithProfileBatches}`);
        console.log(`  - Materials with simpleBatches field: ${materialsWithSimpleBatches}`);
        
        // Get sample material names and their structure
        const sampleMaterials = await collection.find({}).limit(10).toArray();
        
        console.log(`\n[Diagnostic] Sample materials (showing first 10):`);
        sampleMaterials.forEach((material, index) => {
            const hasStockBatches = !!material.stockBatches;
            const stockBatchesCount = material.stockBatches?.length || 0;
            const hasProfileBatches = !!material.profileBatches;
            const profileBatchesCount = material.profileBatches?.length || 0;
            const hasSimpleBatches = !!material.simpleBatches;
            const simpleBatchesCount = material.simpleBatches?.length || 0;
            
            console.log(`  ${index + 1}. ${material.name} (${material.category})`);
            console.log(`     - stockBatches: ${hasStockBatches ? `${stockBatchesCount} batches` : 'not present'}`);
            console.log(`     - profileBatches: ${hasProfileBatches ? `${profileBatchesCount} batches` : 'not present'}`);
            console.log(`     - simpleBatches: ${hasSimpleBatches ? `${simpleBatchesCount} batches` : 'not present'}`);
            console.log(`     - Created: ${material.createdAt}`);
        });
        
        // Check for specific materials mentioned by user
        const userMentionedMaterials = [
            '3 Track Dumal Pipe (27x65mm)',
            'Dumal Shutter Pipe (27x65mm)', 
            'Dumal Interlock (27x65mm)',
            '5mm Clear Glass',
            '5mm Brown Reflective',
            'Dumal Bearing Mangalam (27x65)',
            'Dumal Lock Manghalam (27x65)',
            'Mosquito Mesh'
        ];
        
        console.log(`\n[Diagnostic] Checking for user-mentioned materials:`);
        for (const materialName of userMentionedMaterials) {
            const found = await collection.findOne({ name: materialName });
            if (found) {
                const hasStockBatches = !!found.stockBatches;
                const stockBatchesCount = found.stockBatches?.length || 0;
                console.log(`  ✅ Found: ${materialName}`);
                console.log(`     - stockBatches: ${hasStockBatches ? `${stockBatchesCount} batches` : 'not present'}`);
                console.log(`     - profileBatches: ${!!found.profileBatches}`);
                console.log(`     - simpleBatches: ${!!found.simpleBatches}`);
            } else {
                console.log(`  ❌ Not found: ${materialName}`);
            }
        }
        
        // Check environment variables
        console.log(`\n[Diagnostic] Environment check:`);
        console.log(`  - MONGO_URI: ${process.env.MONGO_URI || 'not set (using default)'}`);
        console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        
    } catch (error) {
        console.error('[Diagnostic] ❌ Check failed:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('[Diagnostic] Disconnected from MongoDB');
        }
    }
};

// Run if called directly
if (require.main === module) {
    diagnosticDBCheck()
        .then(() => {
            console.log('[Diagnostic] Check completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[Diagnostic] Check failed:', error);
            process.exit(1);
        });
}

module.exports = { diagnosticDBCheck }; 