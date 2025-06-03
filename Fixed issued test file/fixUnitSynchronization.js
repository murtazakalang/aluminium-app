const mongoose = require('mongoose');
const Material = require('../models/Material');
const ProductType = require('../models/ProductType');

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aluminiumDB';

async function fixUnitSynchronization() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully.');

        // Get all ProductTypes with materials
        console.log('\nFetching ProductTypes with materials...');
        const productTypes = await ProductType.find({
            'materials.0': { $exists: true } // Only get ProductTypes that have at least one material
        }).populate('materials.materialId', 'usageUnit name');

        console.log(`Found ${productTypes.length} ProductTypes with materials.`);

        let totalUpdated = 0;
        let totalMaterialsProcessed = 0;

        // Process each ProductType
        for (const productType of productTypes) {
            console.log(`\nProcessing ProductType: ${productType.name} (ID: ${productType._id})`);
            
            let hasUpdates = false;
            const updates = [];

            // Check each material in the ProductType
            for (let i = 0; i < productType.materials.length; i++) {
                const materialLink = productType.materials[i];
                totalMaterialsProcessed++;

                // Skip if material reference is missing
                if (!materialLink.materialId) {
                    console.log(`  - Material ${i}: Missing materialId reference, skipping...`);
                    continue;
                }

                const material = materialLink.materialId;
                const currentQuantityUnit = materialLink.quantityUnit;
                const expectedUsageUnit = material.usageUnit;

                console.log(`  - Material ${i}: ${material.name}`);
                console.log(`    Current quantityUnit: ${currentQuantityUnit}`);
                console.log(`    Expected usageUnit: ${expectedUsageUnit}`);

                // Check if synchronization is needed
                if (currentQuantityUnit !== expectedUsageUnit) {
                    console.log(`    ❌ MISMATCH DETECTED! Updating quantityUnit from '${currentQuantityUnit}' to '${expectedUsageUnit}'`);
                    
                    updates.push({
                        [`materials.${i}.quantityUnit`]: expectedUsageUnit
                    });
                    hasUpdates = true;
                } else {
                    console.log(`    ✅ Already synchronized`);
                }
            }

            // Apply updates if any
            if (hasUpdates) {
                const updateDoc = {};
                updates.forEach(update => Object.assign(updateDoc, update));

                await ProductType.updateOne(
                    { _id: productType._id },
                    { $set: updateDoc }
                );

                console.log(`  ✅ Updated ${updates.length} material(s) in ProductType: ${productType.name}`);
                totalUpdated++;
            } else {
                console.log(`  ℹ️  No updates needed for ProductType: ${productType.name}`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('SYNCHRONIZATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`ProductTypes processed: ${productTypes.length}`);
        console.log(`ProductTypes updated: ${totalUpdated}`);
        console.log(`Total materials processed: ${totalMaterialsProcessed}`);
        console.log(`Total materials with mismatched units fixed: ${updates.length || 0}`);

        // Verification step - check if any mismatches remain
        console.log('\nVerifying synchronization...');
        const remainingMismatches = await ProductType.aggregate([
            {
                $lookup: {
                    from: 'materials',
                    localField: 'materials.materialId',
                    foreignField: '_id',
                    as: 'materialDetails'
                }
            },
            {
                $project: {
                    name: 1,
                    mismatches: {
                        $filter: {
                            input: {
                                $map: {
                                    input: '$materials',
                                    as: 'mat',
                                    in: {
                                        materialId: '$$mat.materialId',
                                        quantityUnit: '$$mat.quantityUnit',
                                        usageUnit: {
                                            $let: {
                                                vars: {
                                                    matchedMaterial: {
                                                        $arrayElemAt: [
                                                            {
                                                                $filter: {
                                                                    input: '$materialDetails',
                                                                    cond: { $eq: ['$$this._id', '$$mat.materialId'] }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    }
                                                },
                                                in: '$$matchedMaterial.usageUnit'
                                            }
                                        },
                                        isMismatch: {
                                            $ne: [
                                                '$$mat.quantityUnit',
                                                {
                                                    $let: {
                                                        vars: {
                                                            matchedMaterial: {
                                                                $arrayElemAt: [
                                                                    {
                                                                        $filter: {
                                                                            input: '$materialDetails',
                                                                            cond: { $eq: ['$$this._id', '$$mat.materialId'] }
                                                                        }
                                                                    },
                                                                    0
                                                                ]
                                                            }
                                                        },
                                                        in: '$$matchedMaterial.usageUnit'
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            cond: '$$this.isMismatch'
                        }
                    }
                }
            },
            {
                $match: {
                    'mismatches.0': { $exists: true }
                }
            }
        ]);

        if (remainingMismatches.length === 0) {
            console.log('✅ Verification complete: All units are now synchronized!');
        } else {
            console.log(`⚠️  Warning: ${remainingMismatches.length} ProductTypes still have mismatched units:`);
            remainingMismatches.forEach(pt => {
                console.log(`  - ${pt.name}: ${pt.mismatches.length} mismatched materials`);
            });
        }

    } catch (error) {
        console.error('Error during unit synchronization:', error);
        process.exit(1);
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('\nMongoDB connection closed.');
    }
}

// Run the script
if (require.main === module) {
    console.log('Starting Unit Synchronization Script...');
    console.log('='.repeat(60));
    fixUnitSynchronization()
        .then(() => {
            console.log('\n✅ Unit synchronization completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Unit synchronization failed:', error);
            process.exit(1);
        });
}

module.exports = { fixUnitSynchronization }; 