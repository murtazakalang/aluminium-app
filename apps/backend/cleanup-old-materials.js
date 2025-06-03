const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkAndCleanupOldMaterials() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/aluminium-erp';
    await mongoose.connect(mongoUri);
    console.log('🔌 Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // 1. Check current collections
    console.log('\n📊 Checking current collections...');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    console.log('Collections found:', collectionNames);
    
    // 2. Check Material V1 collection
    let materialsV1Count = 0;
    if (collectionNames.includes('materials')) {
      materialsV1Count = await db.collection('materials').countDocuments();
      console.log(`\n📋 Material V1 Documents: ${materialsV1Count}`);
      
      if (materialsV1Count > 0) {
        const sampleV1 = await db.collection('materials').findOne();
        console.log('Sample V1 Material:', JSON.stringify(sampleV1, null, 2));
      }
    }
    
    // 3. Check Material V2 collection
    let materialsV2Count = 0;
    if (collectionNames.includes('materials_v2')) {
      materialsV2Count = await db.collection('materials_v2').countDocuments();
      console.log(`\n📋 Material V2 Documents: ${materialsV2Count}`);
    }
    
    // 4. Check StockTransactions that reference materials
    let stockTransactionsCount = 0;
    if (collectionNames.includes('stocktransactions')) {
      stockTransactionsCount = await db.collection('stocktransactions').countDocuments();
      console.log(`\n📊 Stock Transactions: ${stockTransactionsCount}`);
    }
    
    // 5. Check ProductTypes that reference materials
    let productTypesCount = 0;
    if (collectionNames.includes('producttypes')) {
      productTypesCount = await db.collection('producttypes').countDocuments();
      console.log(`\n📊 Product Types: ${productTypesCount}`);
    }
    
    // 6. Check Orders that might reference materials
    let ordersCount = 0;
    if (collectionNames.includes('orders')) {
      ordersCount = await db.collection('orders').countDocuments();
      console.log(`\n📊 Orders: ${ordersCount}`);
    }
    
    // 7. Check Estimations that might reference materials
    let estimationsCount = 0;
    if (collectionNames.includes('estimations')) {
      estimationsCount = await db.collection('estimations').countDocuments();
      console.log(`\n📊 Estimations: ${estimationsCount}`);
    }
    
    console.log('\n⚠️  CLEANUP SUMMARY:');
    console.log(`- Material V1 documents to remove: ${materialsV1Count}`);
    console.log(`- Material V2 documents (will keep): ${materialsV2Count}`);
    console.log(`- Stock transactions to review: ${stockTransactionsCount}`);
    console.log(`- Product types to update: ${productTypesCount}`);
    console.log(`- Orders to review: ${ordersCount}`);
    console.log(`- Estimations to review: ${estimationsCount}`);
    
    // Ask for confirmation before proceeding
    console.log('\n🚨 WARNING: This will permanently delete all Material V1 data!');
    console.log('Press Ctrl+C to cancel, or any key to continue...');
    
    // Wait for user input (in a real scenario)
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    console.log('\n🧹 Starting cleanup process...');
    
    // STEP 1: Drop the old materials collection
    if (materialsV1Count > 0) {
      console.log('\n1️⃣ Dropping old materials collection...');
      await db.collection('materials').drop();
      console.log('✅ Old materials collection dropped');
    }
    
    // STEP 2: Remove stock transactions that reference non-existent materials
    if (stockTransactionsCount > 0) {
      console.log('\n2️⃣ Cleaning up orphaned stock transactions...');
      // Find stock transactions that reference materials not in MaterialV2
      const materialV2Ids = await db.collection('materials_v2').distinct('_id');
      const deleteResult = await db.collection('stocktransactions').deleteMany({
        materialId: { $nin: materialV2Ids }
      });
      console.log(`✅ Removed ${deleteResult.deletedCount} orphaned stock transactions`);
    }
    
    // STEP 3: Update ProductTypes to only reference MaterialV2
    if (productTypesCount > 0) {
      console.log('\n3️⃣ Updating product types...');
      const materialV2Ids = await db.collection('materials_v2').distinct('_id');
      
      // Find product types with invalid material references
      const invalidProductTypes = await db.collection('producttypes').find({
        'materials.materialId': { $nin: materialV2Ids }
      }).toArray();
      
      console.log(`Found ${invalidProductTypes.length} product types with invalid material references`);
      
      for (const productType of invalidProductTypes) {
        // Remove materials that don't exist in V2
        const validMaterials = productType.materials.filter(mat => 
          materialV2Ids.some(id => id.toString() === mat.materialId.toString())
        );
        
        await db.collection('producttypes').updateOne(
          { _id: productType._id },
          { $set: { materials: validMaterials } }
        );
        
        console.log(`✅ Updated product type: ${productType.name}`);
      }
    }
    
    // STEP 4: Clean up estimation references
    if (estimationsCount > 0) {
      console.log('\n4️⃣ Cleaning up estimation references...');
      const materialV2Ids = await db.collection('materials_v2').distinct('_id');
      
      const estimationsWithInvalidMaterials = await db.collection('estimations').find({
        'calculatedMaterials.materialId': { $nin: materialV2Ids }
      }).toArray();
      
      console.log(`Found ${estimationsWithInvalidMaterials.length} estimations with invalid material references`);
      
      for (const estimation of estimationsWithInvalidMaterials) {
        const validMaterials = estimation.calculatedMaterials.filter(mat => 
          materialV2Ids.some(id => id.toString() === mat.materialId.toString())
        );
        
        await db.collection('estimations').updateOne(
          { _id: estimation._id },
          { $set: { calculatedMaterials: validMaterials } }
        );
      }
      console.log('✅ Cleaned up estimation references');
    }
    
    // STEP 5: Clean up order references
    if (ordersCount > 0) {
      console.log('\n5️⃣ Cleaning up order references...');
      const materialV2Ids = await db.collection('materials_v2').distinct('_id');
      
      // Clean up aggregatedOrderMaterials
      const ordersWithInvalidMaterials = await db.collection('orders').find({
        'aggregatedOrderMaterials.materialId': { $nin: materialV2Ids }
      }).toArray();
      
      console.log(`Found ${ordersWithInvalidMaterials.length} orders with invalid material references`);
      
      for (const order of ordersWithInvalidMaterials) {
        const validAggregatedMaterials = order.aggregatedOrderMaterials.filter(mat => 
          materialV2Ids.some(id => id.toString() === mat.materialId.toString())
        );
        
        // Also clean up item-level material cuts
        const updatedItems = order.items.map(item => ({
          ...item,
          requiredMaterialCuts: item.requiredMaterialCuts ? 
            item.requiredMaterialCuts.filter(cut => 
              materialV2Ids.some(id => id.toString() === cut.materialId.toString())
            ) : []
        }));
        
        await db.collection('orders').updateOne(
          { _id: order._id },
          { 
            $set: { 
              aggregatedOrderMaterials: validAggregatedMaterials,
              items: updatedItems
            } 
          }
        );
      }
      console.log('✅ Cleaned up order references');
    }
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('\n📊 Final Status:');
    
    // Final verification
    const finalMaterialsV2Count = await db.collection('materials_v2').countDocuments();
    const finalStockTransactionsCount = await db.collection('stocktransactions').countDocuments();
    
    console.log(`✅ Material V2 documents: ${finalMaterialsV2Count}`);
    console.log(`✅ Stock transactions: ${finalStockTransactionsCount}`);
    console.log('✅ All references to old Material V1 schema have been removed');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Execute the cleanup
checkAndCleanupOldMaterials(); 