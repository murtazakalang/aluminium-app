const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkMaterialsV2() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/aluminium-erp';
    console.log('🔌 Connecting to MongoDB...');

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Import MaterialV2 model
    const MaterialV2 = require('./src/models/MaterialV2');

    // Count total materials
    const totalCount = await MaterialV2.countDocuments();
    console.log(`📊 Total MaterialV2 (batch system) materials: ${totalCount}`);

    // Count active materials
    const activeCount = await MaterialV2.countDocuments({ isActive: true });
    console.log(`✅ Active MaterialV2 materials: ${activeCount}`);

    // Get first few materials
    const sampleMaterials = await MaterialV2.find({ isActive: true })
      .select('name category usageUnit isActive')
      .limit(5);

    console.log('\n📋 Sample MaterialV2 materials:');
    sampleMaterials.forEach((material, index) => {
      console.log(`${index + 1}. ${material.name} (${material.category}) - Usage Unit: ${material.usageUnit}`);
    });

    if (totalCount === 0) {
      console.log('\n⚠️  No MaterialV2 found either!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkMaterialsV2();