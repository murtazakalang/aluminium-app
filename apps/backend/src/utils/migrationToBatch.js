const mongoose = require('mongoose');
const MaterialV2 = require('../models/MaterialV2');
 // Old schema
 // New batch schema

/**
 * Migration utility to convert existing materials to batch format
 */
class MigrationToBatch {

    /**
     * Migrate a single material from old to new format
     * @param {Object} oldMaterial - MaterialV2 from old schema
     * @param {string} userId - User performing migration
     * @returns {Object} - Migration result
     */
    static async migrateSingleMaterial(oldMaterial, userId) {
        try {
            console.log(`[Migration] Starting migration for material: ${oldMaterial.name}`);

            // Check if already migrated
            const existingV2 = await MaterialV2.findOne({
                companyId: oldMaterial.companyId,
                name: oldMaterial.name
            });

            if (existingV2) {
                console.log(`[Migration] MaterialV2 ${oldMaterial.name} already migrated, skipping`);
                return { success: true, skipped: true };
            }

            // Create new V2 material
            const newMaterial = new MaterialV2({
                companyId: oldMaterial.companyId,
                name: oldMaterial.name,
                category: oldMaterial.category,
                stockUnit: oldMaterial.stockUnit,
                usageUnit: oldMaterial.usageUnit,
                standardLengths: oldMaterial.standardLengths || [],
                supplier: oldMaterial.supplier,
                brand: oldMaterial.brand,
                hsnCode: oldMaterial.hsnCode,
                description: oldMaterial.description,
                isActive: oldMaterial.isActive,
                migrationStatus: 'migrated',
                createdBy: oldMaterial.createdBy || userId,
                updatedBy: userId,
                stockBatches: [],
                referenceGaugeWeights: []
            });

            // Convert gaugeSpecificWeights to referenceGaugeWeights
            if (oldMaterial.gaugeSpecificWeights && oldMaterial.gaugeSpecificWeights.length > 0) {
                oldMaterial.gaugeSpecificWeights.forEach(gw => {
                    if (gw.weightPerUnitLength && parseFloat(gw.weightPerUnitLength.toString()) > 0) {
                        newMaterial.referenceGaugeWeights.push({
                            gauge: gw.gauge,
                            referenceWeight: gw.weightPerUnitLength,
                            unitLength: gw.unitLength || 'ft'
                        });
                    }
                });
            }

            // Convert stockByLength entries to batches
            let batchCount = 0;
            if (oldMaterial.stockByLength && oldMaterial.stockByLength.length > 0) {
                for (const stockItem of oldMaterial.stockByLength) {
                    const quantity = parseFloat(stockItem.quantity?.toString() || '0');
                    const unitRate = parseFloat(stockItem.unitRate?.toString() || '0');
                    
                    if (quantity > 0 && unitRate > 0) {
                        const totalCost = quantity * unitRate;
                        const actualWeight = stockItem.actualWeight ? 
                            parseFloat(stockItem.actualWeight.toString()) : null;

                        // Generate batch ID with sequence
                        const batchId = `MIGRATED_${Date.now()}_${String(batchCount).padStart(3, '0')}`;

                        const batch = {
                            batchId,
                            length: stockItem.length,
                            lengthUnit: stockItem.unit,
                            gauge: stockItem.gauge,
                            originalQuantity: stockItem.quantity,
                            currentQuantity: stockItem.quantity,
                            actualTotalWeight: actualWeight ? 
                                mongoose.Types.Decimal128.fromString(String(actualWeight)) : null,
                            actualWeightUnit: 'kg',
                            totalCostPaid: mongoose.Types.Decimal128.fromString(String(totalCost)),
                            ratePerPiece: stockItem.unitRate,
                            ratePerKg: actualWeight ? 
                                mongoose.Types.Decimal128.fromString(String(totalCost / actualWeight)) : null,
                            supplier: oldMaterial.supplier,
                            purchaseDate: oldMaterial.createdAt || new Date(),
                            invoiceNumber: null,
                            lotNumber: null,
                            notes: `Migrated from old system - Original stock entry`,
                            isActive: true,
                            isCompleted: false,
                            lowStockThreshold: stockItem.lowStockThreshold || mongoose.Types.Decimal128.fromString('0')
                        };

                        newMaterial.stockBatches.push(batch);
                        batchCount++;

                        console.log(`[Migration] Created batch ${batchId}: ${quantity} pieces, ${actualWeight || 'N/A'}kg, ₹${unitRate}/piece`);
                    }
                }
            }

            // Save the new material (triggers aggregation calculation)
            await newMaterial.save();

            console.log(`[Migration] ✅ Successfully migrated ${oldMaterial.name} with ${batchCount} batches`);

            return {
                success: true,
                migrated: true,
                batchCount,
                materialId: newMaterial._id
            };

        } catch (error) {
            console.error(`[Migration] ❌ Failed to migrate ${oldMaterial.name}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Migrate all materials for a company
     * @param {string} companyId 
     * @param {string} userId 
     * @returns {Object} - Migration summary
     */
    static async migrateCompanyMaterials(companyId, userId) {
        try {
            console.log(`[Migration] Starting migration for company: ${companyId}`);

            const oldMaterials = await MaterialV2.find({ 
                companyId, 
                isActive: true,
                category: 'Profile' // Start with profiles only
            });

            console.log(`[Migration] Found ${oldMaterials.length} materials to migrate`);

            const results = {
                total: oldMaterials.length,
                migrated: 0,
                skipped: 0,
                failed: 0,
                errors: []
            };

            for (const oldMaterial of oldMaterials) {
                const result = await this.migrateSingleMaterial(oldMaterial, userId);
                
                if (result.success) {
                    if (result.skipped) {
                        results.skipped++;
                    } else {
                        results.migrated++;
                    }
                } else {
                    results.failed++;
                    results.errors.push({
                        materialName: oldMaterial.name,
                        error: result.error
                    });
                }

                // Small delay to prevent overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`[Migration] ✅ Company migration complete: ${results.migrated} migrated, ${results.skipped} skipped, ${results.failed} failed`);

            return results;

        } catch (error) {
            console.error('[Migration] ❌ Company migration failed:', error);
            throw error;
        }
    }

    /**
     * Migrate all materials across all companies
     * @param {string} userId 
     * @returns {Object} - Migration summary
     */
    static async migrateAllMaterials(userId) {
        try {
            console.log('[Migration] Starting global migration');

            // Get all unique company IDs
            const companies = await MaterialV2.distinct('companyId', { 
                isActive: true,
                category: 'Profile'
            });

            console.log(`[Migration] Found ${companies.length} companies with profile materials`);

            const globalResults = {
                totalCompanies: companies.length,
                totalMaterials: 0,
                totalMigrated: 0,
                totalSkipped: 0,
                totalFailed: 0,
                companyResults: [],
                errors: []
            };

            for (const companyId of companies) {
                try {
                    const companyResult = await this.migrateCompanyMaterials(companyId, userId);
                    
                    globalResults.totalMaterials += companyResult.total;
                    globalResults.totalMigrated += companyResult.migrated;
                    globalResults.totalSkipped += companyResult.skipped;
                    globalResults.totalFailed += companyResult.failed;
                    globalResults.companyResults.push({
                        companyId,
                        ...companyResult
                    });
                    globalResults.errors.push(...companyResult.errors);

                } catch (error) {
                    console.error(`[Migration] ❌ Failed to migrate company ${companyId}:`, error);
                    globalResults.totalFailed++;
                    globalResults.errors.push({
                        companyId,
                        error: error.message
                    });
                }
            }

            console.log(`[Migration] ✅ Global migration complete: ${globalResults.totalMigrated} migrated, ${globalResults.totalSkipped} skipped, ${globalResults.totalFailed} failed`);

            return globalResults;

        } catch (error) {
            console.error('[Migration] ❌ Global migration failed:', error);
            throw error;
        }
    }

    /**
     * Validate migrated data
     * @param {string} companyId 
     * @returns {Object} - Validation results
     */
    static async validateMigration(companyId) {
        try {
            const oldMaterials = await MaterialV2.find({ companyId, isActive: true, category: 'Profile' });
            const newMaterials = await MaterialV2.find({ companyId, isActive: true, migrationStatus: 'migrated' });

            const validation = {
                oldMaterialsCount: oldMaterials.length,
                newMaterialsCount: newMaterials.length,
                stockComparison: [],
                discrepancies: []
            };

            for (const oldMaterial of oldMaterials) {
                const newMaterial = newMaterials.find(nm => nm.name === oldMaterial.name);
                
                if (!newMaterial) {
                    validation.discrepancies.push(`MaterialV2 ${oldMaterial.name} not found in new system`);
                    continue;
                }

                // Compare total stock quantities
                const oldTotalStock = parseFloat(oldMaterial.totalStockQuantity?.toString() || '0');
                const newTotalStock = parseFloat(newMaterial.aggregatedTotals.totalCurrentStock?.toString() || '0');

                validation.stockComparison.push({
                    materialName: oldMaterial.name,
                    oldStock: oldTotalStock,
                    newStock: newTotalStock,
                    difference: Math.abs(oldTotalStock - newTotalStock),
                    matches: Math.abs(oldTotalStock - newTotalStock) < 0.01
                });

                if (Math.abs(oldTotalStock - newTotalStock) >= 0.01) {
                    validation.discrepancies.push(
                        `Stock mismatch for ${oldMaterial.name}: Old=${oldTotalStock}, New=${newTotalStock}`
                    );
                }
            }

            return validation;

        } catch (error) {
            console.error('[Migration] Validation failed:', error);
            throw error;
        }
    }
}

module.exports = MigrationToBatch; 