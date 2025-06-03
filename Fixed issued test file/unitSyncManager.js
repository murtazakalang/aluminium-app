const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Material = require('../models/Material');
const ProductType = require('../models/ProductType');

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/aluminiumDB';

class UnitSyncManager {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.ensureBackupDir();
    }

    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async connect() {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully.');
    }

    async disconnect() {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }

    async createBackup() {
        console.log('\n📦 Creating backup...');
        const productTypes = await ProductType.find({}).lean();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.backupDir, `productTypes_backup_${timestamp}.json`);
        
        fs.writeFileSync(backupFile, JSON.stringify(productTypes, null, 2));
        
        console.log(`✅ Backup created: ${backupFile}`);
        console.log(`Total ProductTypes backed up: ${productTypes.length}`);
        
        return backupFile;
    }

    async analyzeUnitMismatches() {
        console.log('\n🔍 Analyzing unit mismatches...');
        
        const productTypes = await ProductType.find({
            'materials.0': { $exists: true }
        }).populate('materials.materialId', 'usageUnit name category');

        let totalMismatches = 0;
        const mismatchDetails = [];

        for (const productType of productTypes) {
            const mismatches = [];
            
            for (let i = 0; i < productType.materials.length; i++) {
                const materialLink = productType.materials[i];
                
                if (!materialLink.materialId) continue;
                
                const material = materialLink.materialId;
                const currentQuantityUnit = materialLink.quantityUnit;
                const expectedUsageUnit = material.usageUnit;
                
                if (currentQuantityUnit !== expectedUsageUnit) {
                    mismatches.push({
                        index: i,
                        materialName: material.name,
                        materialCategory: material.category,
                        currentQuantityUnit,
                        expectedUsageUnit
                    });
                    totalMismatches++;
                }
            }
            
            if (mismatches.length > 0) {
                mismatchDetails.push({
                    productTypeName: productType.name,
                    productTypeId: productType._id,
                    mismatches
                });
            }
        }

        console.log(`Found ${totalMismatches} unit mismatches across ${mismatchDetails.length} ProductTypes`);
        
        // Display detailed analysis
        if (mismatchDetails.length > 0) {
            console.log('\n📋 Detailed Mismatch Analysis:');
            mismatchDetails.forEach(pt => {
                console.log(`\n  ProductType: ${pt.productTypeName}`);
                pt.mismatches.forEach(mismatch => {
                    console.log(`    • ${mismatch.materialName} (${mismatch.materialCategory}): ${mismatch.currentQuantityUnit} → ${mismatch.expectedUsageUnit}`);
                });
            });
        }

        return { totalMismatches, mismatchDetails };
    }

    async fixUnitSynchronization(dryRun = false) {
        const modeText = dryRun ? '🧪 DRY RUN' : '🔧 FIXING';
        console.log(`\n${modeText}: Unit synchronization...`);
        
        const productTypes = await ProductType.find({
            'materials.0': { $exists: true }
        }).populate('materials.materialId', 'usageUnit name');

        let totalUpdated = 0;
        let totalMaterialsProcessed = 0;
        let totalMismatchesFixed = 0;

        for (const productType of productTypes) {
            let hasUpdates = false;
            const updates = [];

            for (let i = 0; i < productType.materials.length; i++) {
                const materialLink = productType.materials[i];
                totalMaterialsProcessed++;

                if (!materialLink.materialId) continue;

                const material = materialLink.materialId;
                const currentQuantityUnit = materialLink.quantityUnit;
                const expectedUsageUnit = material.usageUnit;

                if (currentQuantityUnit !== expectedUsageUnit) {
                    updates.push({
                        [`materials.${i}.quantityUnit`]: expectedUsageUnit
                    });
                    totalMismatchesFixed++;
                    hasUpdates = true;
                    
                    if (dryRun) {
                        console.log(`    Would update: ${material.name} (${currentQuantityUnit} → ${expectedUsageUnit})`);
                    }
                }
            }

            if (hasUpdates && !dryRun) {
                const updateDoc = {};
                updates.forEach(update => Object.assign(updateDoc, update));

                await ProductType.updateOne(
                    { _id: productType._id },
                    { $set: updateDoc }
                );

                totalUpdated++;
            } else if (hasUpdates && dryRun) {
                console.log(`  Would update ProductType: ${productType.name} (${updates.length} materials)`);
            }
        }

        const action = dryRun ? 'would be' : 'were';
        console.log(`\n📊 Summary:`);
        console.log(`  • ProductTypes processed: ${productTypes.length}`);
        console.log(`  • ProductTypes that ${action} updated: ${dryRun ? (totalMismatchesFixed > 0 ? 'Some' : 'None') : totalUpdated}`);
        console.log(`  • Total materials processed: ${totalMaterialsProcessed}`);
        console.log(`  • Total mismatches that ${action} fixed: ${totalMismatchesFixed}`);

        return { totalUpdated, totalMaterialsProcessed, totalMismatchesFixed };
    }

    async restoreFromBackup(backupFile) {
        console.log(`\n🔄 Restoring from backup: ${backupFile}`);
        
        if (!fs.existsSync(backupFile)) {
            throw new Error(`Backup file not found: ${backupFile}`);
        }

        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        
        console.log(`Restoring ${backupData.length} ProductTypes...`);
        
        // Clear existing data and restore
        await ProductType.deleteMany({});
        await ProductType.insertMany(backupData);
        
        console.log('✅ Restore completed successfully!');
        
        return backupData.length;
    }

    async verifyIntegrity() {
        console.log('\n🔍 Verifying data integrity...');
        
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
            console.log('✅ Verification passed: All units are synchronized!');
            return true;
        } else {
            console.log(`⚠️  Warning: ${remainingMismatches.length} ProductTypes still have mismatched units`);
            return false;
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const manager = new UnitSyncManager();
    
    try {
        await manager.connect();
        
        switch (command) {
            case 'backup':
                await manager.createBackup();
                break;
                
            case 'analyze':
                await manager.analyzeUnitMismatches();
                break;
                
            case 'dry-run':
                await manager.analyzeUnitMismatches();
                await manager.fixUnitSynchronization(true);
                break;
                
            case 'fix':
                console.log('⚠️  This will modify your database. Creating backup first...');
                const backupFile = await manager.createBackup();
                console.log(`Backup created: ${backupFile}`);
                
                await manager.fixUnitSynchronization(false);
                await manager.verifyIntegrity();
                break;
                
            case 'restore':
                const restoreFile = args[1];
                if (!restoreFile) {
                    console.error('❌ Please specify a backup file to restore from');
                    process.exit(1);
                }
                await manager.restoreFromBackup(restoreFile);
                break;
                
            case 'verify':
                await manager.verifyIntegrity();
                break;
                
            default:
                console.log(`
Unit Synchronization Manager
============================

Usage: node unitSyncManager.js <command> [options]

Commands:
  backup      Create a backup of all ProductTypes
  analyze     Analyze unit mismatches without making changes
  dry-run     Show what would be changed without actually changing it
  fix         Fix unit mismatches (creates backup automatically)
  restore     Restore from backup file: restore <backup-file>
  verify      Verify data integrity

Examples:
  node unitSyncManager.js backup
  node unitSyncManager.js analyze
  node unitSyncManager.js dry-run
  node unitSyncManager.js fix
  node unitSyncManager.js restore /path/to/backup.json
  node unitSyncManager.js verify
                `);
                process.exit(0);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await manager.disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = UnitSyncManager; 