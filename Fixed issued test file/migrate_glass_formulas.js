const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aluminium-app';

async function migrateGlassFormulas() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const ProductType = mongoose.connection.collection('producttypes');
        
        // Find all ProductTypes with legacy glass formula fields
        const productsWithLegacyFormulas = await ProductType.find({
            $or: [
                { 'glassAreaFormula.formula': { $exists: true } },
                { 'glassAreaFormula.formulaType': { $exists: true } }
            ]
        }).toArray();

        console.log(`📊 Found ${productsWithLegacyFormulas.length} products with legacy glass formula fields`);

        if (productsWithLegacyFormulas.length === 0) {
            console.log('✅ No migration needed - all products already use new format');
            return;
        }

        let migratedCount = 0;
        let skippedCount = 0;

        for (const product of productsWithLegacyFormulas) {
            const updates = {};
            let needsUpdate = false;

            // Remove legacy fields
            if (product.glassAreaFormula?.formula !== undefined) {
                updates['$unset'] = updates['$unset'] || {};
                updates['$unset']['glassAreaFormula.formula'] = '';
                needsUpdate = true;
                console.log(`  - Removing legacy formula field from product: ${product.name}`);
            }

            if (product.glassAreaFormula?.formulaType !== undefined) {
                updates['$unset'] = updates['$unset'] || {};
                updates['$unset']['glassAreaFormula.formulaType'] = '';
                needsUpdate = true;
                console.log(`  - Removing formulaType field from product: ${product.name}`);
            }

            // Ensure required fields have defaults
            if (!product.glassAreaFormula?.widthFormula) {
                updates['$set'] = updates['$set'] || {};
                updates['$set']['glassAreaFormula.widthFormula'] = '';
                needsUpdate = true;
            }

            if (!product.glassAreaFormula?.heightFormula) {
                updates['$set'] = updates['$set'] || {};
                updates['$set']['glassAreaFormula.heightFormula'] = '';
                needsUpdate = true;
            }

            if (!product.glassAreaFormula?.glassQuantity) {
                updates['$set'] = updates['$set'] || {};
                updates['$set']['glassAreaFormula.glassQuantity'] = 1;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await ProductType.updateOne(
                    { _id: product._id },
                    updates
                );
                migratedCount++;
                console.log(`✅ Migrated product: ${product.name}`);
            } else {
                skippedCount++;
                console.log(`⏭️  Skipped product: ${product.name} (no changes needed)`);
            }
        }

        console.log('\n📋 Migration Summary:');
        console.log(`  • Products found with legacy fields: ${productsWithLegacyFormulas.length}`);
        console.log(`  • Products migrated: ${migratedCount}`);
        console.log(`  • Products skipped: ${skippedCount}`);
        console.log('\n✅ Glass formula migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateGlassFormulas()
        .then(() => {
            console.log('🎉 Migration script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateGlassFormulas }; 