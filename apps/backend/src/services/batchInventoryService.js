const mongoose = require('mongoose');
const Decimal = require('decimal.js');
const MaterialV2 = require('../models/MaterialV2');
const StockTransaction = require('../models/StockTransaction');

/**
 * Batch-Based Inventory Service
 * Handles all stock operations with proper batch tracking and weight preservation
 */
class BatchInventoryService {

    /**
     * Record stock inward as a new batch
     * @param {string} companyId 
     * @param {string} userId 
     * @param {object} data - Stock inward data
     * @returns {object} - Result with material and batch details
     */
    static async recordStockInward(companyId, userId, data) {
        const {
            materialId,
            length, lengthUnit, gauge,
            quantity, actualWeight, actualWeightUnit,
            totalCost, supplier, invoiceNumber, lotNumber, notes,
            // For new material creation
            name, category, stockUnit, usageUnit, brand, hsnCode, description
        } = data;

        // Validate required fields
        if (!quantity || quantity <= 0) {
            throw new Error('Quantity must be greater than 0');
        }
        if (!totalCost || totalCost <= 0) {
            throw new Error('Total cost must be greater than 0');
        }
        
        // TEMPORARILY COMMENTED OUT - Only validate length after loading material
        // Only require length for Profile materials (other categories don't need length/gauge)
        // if (category === 'Profile' || (materialId && !category)) {
        //     // For existing materials, we'll check category after loading the material
        //     // For new materials, we know the category from the input
        //     if (!length || length <= 0) {
        //         throw new Error('Length must be greater than 0 for Profile materials');
        //     }
        // }

        let material;
        let isNewMaterial = false;

        // Find or create material
        if (materialId) {
            // Find in MaterialV2 system
            material = await MaterialV2.findOne({ _id: materialId, companyId });
            
            if (!material) {
                throw new Error('Material not found or access denied');
            }
        } else {
            // Create completely new material
            if (!name || !category || !stockUnit || !usageUnit) {
                throw new Error('Missing required fields for new material creation');
            }

            // Check if material with same name already exists
            const existingMaterial = await MaterialV2.findOne({ 
                companyId, 
                name: name.trim() 
            });
            
            if (existingMaterial) {
                throw new Error(`Material with name '${name}' already exists. Please use the existing material or choose a different name.`);
            }

            material = new MaterialV2({
                companyId,
                name: name.trim(),
                category,
                stockUnit,
                usageUnit,
                supplier,
                brand,
                hsnCode,
                description,
                stockBatches: [],
                standardLengths: [],
                referenceGaugeWeights: [],
                createdBy: userId,
                updatedBy: userId
            });
            isNewMaterial = true;
        }

        // Debug logging
        console.log(`[DEBUG] Material category: ${material.category}, length: ${length}, gauge: ${gauge}`);

        // Additional validation for Profile materials after material is loaded
        if (material.category === 'Profile') {
            if (length === undefined || length === null || length <= 0) {
                throw new Error('Length must be greater than 0 for Profile materials');
            }
            if (!gauge) {
                throw new Error('Gauge is required for Profile materials');
            }
        }

        // Add standard length if not exists (only for Profile materials)
        if (material.category === 'Profile') {
            // Ensure length and lengthUnit are provided before trying to use them
            if (length === undefined || length === null || !lengthUnit) {
                throw new Error('Length and Length Unit are required to add standard length for Profile materials');
            }
            const lengthExists = material.standardLengths.some(sl => 
                sl.length.toString() === String(length) && sl.unit === lengthUnit
            );
            if (!lengthExists) {
                material.standardLengths.push({
                    length: mongoose.Types.Decimal128.fromString(String(length)),
                    unit: lengthUnit
                });
            }
        }

        // Generate unique batch ID
        const batchId = MaterialV2.generateBatchId();

        // Calculate rates
        const ratePerPiece = parseFloat((totalCost / quantity).toFixed(4));
        const ratePerKg = actualWeight ? parseFloat((totalCost / actualWeight).toFixed(4)) : null;

        // Create new batch entry based on material category
        let newBatch;
        
        if (material.category === 'Profile') {
            // Profile materials need length, gauge, and weight tracking
            if (!length || length <= 0) {
                throw new Error('Length must be greater than 0 for Profile materials');
            }
            if (!gauge) {
                throw new Error('Gauge is required for Profile materials');
            }
            
            newBatch = {
                batchId,
                length: mongoose.Types.Decimal128.fromString(String(length)),
                lengthUnit: lengthUnit,
                gauge: gauge,
                originalQuantity: mongoose.Types.Decimal128.fromString(String(quantity)),
                currentQuantity: mongoose.Types.Decimal128.fromString(String(quantity)),
                actualTotalWeight: actualWeight ? mongoose.Types.Decimal128.fromString(String(actualWeight)) : null,
                actualWeightUnit: actualWeightUnit || 'kg',
                totalCostPaid: mongoose.Types.Decimal128.fromString(String(totalCost)),
                ratePerPiece: mongoose.Types.Decimal128.fromString(String(ratePerPiece)),
                ratePerKg: ratePerKg ? mongoose.Types.Decimal128.fromString(String(ratePerKg)) : null,
                supplier: supplier || material.supplier,
                purchaseDate: new Date(),
                invoiceNumber,
                lotNumber,
                notes,
                isActive: true,
                isCompleted: false,
                lowStockThreshold: mongoose.Types.Decimal128.fromString('0')
            };
            
            // Add the batch to profileBatches
            material.profileBatches.push(newBatch);
            
        } else {
            // Non-Profile materials use simple batch tracking
            // For Wire Mesh, include width and length information
            if (material.category === 'Wire Mesh') {
                // For Wire Mesh, expect length and width information
                if (!length || length <= 0) {
                    throw new Error('Roll length must be greater than 0 for Wire Mesh materials');
                }
                if (!lengthUnit) {
                    throw new Error('Length unit is required for Wire Mesh materials');
                }
                
                // Find the selected width from standard widths (stored as standardLengths)
                const selectedWidth = material.standardLengths.find(sl => 
                    parseFloat(sl.length.toString()) === parseFloat(gauge) // Using gauge field to pass selected width
                );
                
                if (!selectedWidth) {
                    throw new Error(`Selected width ${gauge} not found in standard widths for this Wire Mesh material`);
                }
                
                // Calculate total area = width × length × quantity
                const widthValue = parseFloat(selectedWidth.length.toString());
                const lengthValue = parseFloat(length.toString());
                const totalAreaPerPiece = widthValue * lengthValue;
                const totalArea = totalAreaPerPiece * quantity;
                
                newBatch = {
                    batchId,
                    selectedWidth: mongoose.Types.Decimal128.fromString(String(widthValue)),
                    widthUnit: selectedWidth.unit,
                    rollLength: mongoose.Types.Decimal128.fromString(String(lengthValue)),
                    rollLengthUnit: lengthUnit,
                    areaPerRoll: mongoose.Types.Decimal128.fromString(String(totalAreaPerPiece)),
                    totalArea: mongoose.Types.Decimal128.fromString(String(totalArea)),
                    areaUnit: selectedWidth.unit === 'ft' ? 'sqft' : selectedWidth.unit === 'm' ? 'sqm' : 'sqft',
                    originalQuantity: mongoose.Types.Decimal128.fromString(String(quantity)),
                    currentQuantity: mongoose.Types.Decimal128.fromString(String(quantity)),
                    totalCostPaid: mongoose.Types.Decimal128.fromString(String(totalCost)),
                    ratePerUnit: mongoose.Types.Decimal128.fromString(String(ratePerPiece)), // Rate per roll/piece
                    ratePerArea: mongoose.Types.Decimal128.fromString(String(totalCost / totalArea)), // Rate per sqft
                    supplier: supplier || material.supplier,
                    purchaseDate: new Date(),
                    invoiceNumber,
                    lotNumber,
                    notes,
                    isActive: true,
                    isCompleted: false,
                    lowStockThreshold: mongoose.Types.Decimal128.fromString('0')
                };
                
                console.log(`[BatchInventory] Wire Mesh batch: ${widthValue}${selectedWidth.unit} × ${lengthValue}${lengthUnit} × ${quantity} rolls = ${totalArea.toFixed(2)} ${newBatch.areaUnit}`);
                
            } else {
                // Other non-Profile materials (Glass, Hardware, etc.)
                newBatch = {
                    batchId,
                    originalQuantity: mongoose.Types.Decimal128.fromString(String(quantity)),
                    currentQuantity: mongoose.Types.Decimal128.fromString(String(quantity)),
                    totalCostPaid: mongoose.Types.Decimal128.fromString(String(totalCost)),
                    ratePerUnit: mongoose.Types.Decimal128.fromString(String(ratePerPiece)),
                    supplier: supplier || material.supplier,
                    purchaseDate: new Date(),
                    invoiceNumber,
                    lotNumber,
                    notes,
                    isActive: true,
                    isCompleted: false,
                    lowStockThreshold: mongoose.Types.Decimal128.fromString('0')
                };
            }
            
            // Add the batch to simpleBatches
            material.simpleBatches.push(newBatch);
        }

        // Add or update reference gauge weight if this is a profile and we have actual weight
        if (material.category === 'Profile' && gauge && actualWeight) {
            const existingGaugeIndex = material.referenceGaugeWeights.findIndex(gw => gw.gauge === gauge);
            const currentBatchTotalLength = length * quantity;
            const currentBatchWeightPerUnitLength = actualWeight / currentBatchTotalLength;
            
            if (existingGaugeIndex !== -1) {
                // Calculate weighted average with all existing batches for this gauge
                const existingBatches = material.profileBatches.filter(b => b.gauge === gauge && b.actualTotalWeight);
                let totalWeightedLength = 0;
                let totalWeight = 0;
                
                // Include all existing batches for this gauge
                existingBatches.forEach(batch => {
                    const batchLength = parseFloat(batch.length.toString()) * parseFloat(batch.originalQuantity.toString());
                    const batchWeight = parseFloat(batch.actualTotalWeight.toString());
                    totalWeightedLength += batchLength;
                    totalWeight += batchWeight;
                });
                
                // Add current batch
                totalWeightedLength += currentBatchTotalLength;
                totalWeight += actualWeight;
                
                // Calculate new weighted average
                const newWeightPerUnitLength = totalWeight / totalWeightedLength;
                material.referenceGaugeWeights[existingGaugeIndex].referenceWeight = mongoose.Types.Decimal128.fromString(String(newWeightPerUnitLength));
                
                console.log(`[BatchInventory] Updated reference gauge weight for ${gauge}: ${newWeightPerUnitLength.toFixed(4)} kg/${lengthUnit} (weighted average from ${existingBatches.length + 1} batches)`);
            } else {
                // Add new gauge weight
                material.referenceGaugeWeights.push({
                    gauge,
                    referenceWeight: mongoose.Types.Decimal128.fromString(String(currentBatchWeightPerUnitLength)),
                    unitLength: lengthUnit
                });
                console.log(`[BatchInventory] Added reference gauge weight for ${gauge}: ${currentBatchWeightPerUnitLength.toFixed(4)} kg/${lengthUnit}`);
            }
        }

        material.updatedBy = userId;

        // Save material (triggers aggregation update)
        await material.save();

        // Create stock transaction record
        await this.createStockTransaction({
            companyId,
            materialId: material._id,
            batchId,
            type: isNewMaterial ? 'InitialStock' : 'Inward',
            quantityChange: quantity,
            unitRateAtTransaction: ratePerPiece,
            length: material.category === 'Profile' ? length : undefined,
            lengthUnit: material.category === 'Profile' ? lengthUnit : undefined,
            gauge: material.category === 'Profile' ? gauge : undefined,
            notes: material.category === 'Profile' 
                ? `Stock inward: ${quantity} pieces of ${length}${lengthUnit}${gauge ? ` ${gauge}` : ''}${supplier ? ` from ${supplier}` : ''}`
                : `Stock inward: ${quantity} ${material.usageUnit} of ${material.name}${supplier ? ` from ${supplier}` : ''}`,
            createdBy: userId
        });

        console.log(`[BatchInventory] ✅ Created batch ${batchId}: ${quantity} pieces, ${actualWeight || 'N/A'}kg, ₹${ratePerPiece}/piece`);

        return {
            success: true,
            material,
            batch: newBatch,
            batchId,
            isNewMaterial
        };
    }

    /**
     * Consume Wire Mesh stock based on required dimensions
     * @param {string} materialId 
     * @param {object} consumeData 
     * @returns {object} - Consumption details with optimization
     */
    static async consumeWireMeshStock(materialId, consumeData) {
        const {
            companyId,
            requiredWidth,     // Required width for the product
            requiredLength,    // Required length for the product
            requiredArea,      // Required total area (can be calculated from width × length)
            quantity = 1,      // Number of pieces needed
            consumptionType = 'Production',
            sortOrder = 'FIFO',
            notes,
            userId
        } = consumeData;

        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material || material.category !== 'Wire Mesh') {
            throw new Error('Wire Mesh material not found or access denied');
        }

        // Calculate total area needed
        const totalAreaNeeded = requiredArea || (requiredWidth * requiredLength * quantity);
        
        // Find optimal width using Wire Mesh optimization service
        const WireMeshOptimizationService = require('./wireMeshOptimizationService');
        const optimization = WireMeshOptimizationService.findOptimalWidth(
            material.standardLengths || [], // standardWidths array
            requiredWidth,                  // requiredWidth number
            'ft'                           // unit string
        );
        
        if (!optimization.selectedWidth) {
            throw new Error(`No suitable width available for ${requiredWidth}ft requirement`);
        }

        // Find available batches with the optimal width
        const availableBatches = material.simpleBatches.filter(batch => 
            batch.isActive && 
            !batch.isCompleted && 
            batch.selectedWidth && 
            parseFloat(batch.selectedWidth.toString()) === optimization.selectedWidth &&
            batch.totalArea && 
            parseFloat(batch.totalArea.toString()) > 0
        );

        if (availableBatches.length === 0) {
            throw new Error(`No stock available for ${optimization.selectedWidth}ft width`);
        }

        // Sort batches by purchase date (FIFO/LIFO)
        availableBatches.sort((a, b) => {
            const dateA = new Date(a.purchaseDate);
            const dateB = new Date(b.purchaseDate);
            return sortOrder === 'FIFO' ? dateA - dateB : dateB - dateA;
        });

        // Calculate total available area
        const totalAvailableArea = availableBatches.reduce((sum, batch) => 
            sum + parseFloat(batch.totalArea.toString()), 0
        );

        if (totalAvailableArea < totalAreaNeeded) {
            throw new Error(`Insufficient area. Required: ${totalAreaNeeded} sqft, Available: ${totalAvailableArea.toFixed(2)} sqft`);
        }

        let remainingAreaToConsume = totalAreaNeeded;
        const consumedBatches = [];
        const transactionsToCreate = [];

        // Consume from batches
        for (const batch of availableBatches) {
            if (remainingAreaToConsume <= 0) break;

            const availableArea = parseFloat(batch.totalArea.toString());
            const availableRolls = parseFloat(batch.currentQuantity.toString());
            const areaPerRoll = parseFloat(batch.areaPerRoll.toString());
            
            // Calculate how much area to consume from this batch
            const areaToConsume = Math.min(remainingAreaToConsume, availableArea);
            
            // Calculate how many rolls this represents (could be fractional)
            const rollsToConsume = areaToConsume / areaPerRoll;
            
            // Update batch quantities
            const newRollQuantity = availableRolls - rollsToConsume;
            const newTotalArea = availableArea - areaToConsume;
            
            batch.currentQuantity = mongoose.Types.Decimal128.fromString(String(Math.max(0, newRollQuantity)));
            batch.totalArea = mongoose.Types.Decimal128.fromString(String(Math.max(0, newTotalArea)));

            // Mark as completed if fully consumed
            if (newRollQuantity <= 0.001 || newTotalArea <= 0.001) {
                batch.isCompleted = true;
                batch.currentQuantity = mongoose.Types.Decimal128.fromString('0');
                batch.totalArea = mongoose.Types.Decimal128.fromString('0');
            }

            // Calculate cost for consumed area
            const batchRatePerArea = batch.ratePerArea ? parseFloat(batch.ratePerArea.toString()) : 
                parseFloat(batch.ratePerUnit.toString()) / areaPerRoll;
            const consumedCost = areaToConsume * batchRatePerArea;

            consumedBatches.push({
                batchId: batch.batchId,
                selectedWidth: parseFloat(batch.selectedWidth.toString()),
                rollsConsumed: rollsToConsume,
                areaConsumed: areaToConsume,
                ratePerArea: batchRatePerArea,
                cost: consumedCost,
                supplier: batch.supplier,
                purchaseDate: batch.purchaseDate,
                invoiceNumber: batch.invoiceNumber,
                optimization: {
                    requiredWidth: requiredWidth,
                    usedWidth: optimization.selectedWidth,
                    wastageWidth: optimization.selectedWidth - requiredWidth,
                    wastePercentage: ((optimization.selectedWidth - requiredWidth) / optimization.selectedWidth * 100)
                }
            });

            // Prepare transaction record
            transactionsToCreate.push({
                companyId,
                materialId: material._id,
                type: 'Outward-OrderCut',
                quantityChange: mongoose.Types.Decimal128.fromString((-areaToConsume).toString()),
                quantityUnit: 'sqft',
                unitRateAtTransaction: mongoose.Types.Decimal128.fromString(batchRatePerArea.toString()),
                totalValueChange: mongoose.Types.Decimal128.fromString((-consumedCost).toString()),
                relatedDocumentType: 'BatchOperation',
                relatedDocumentId: null,
                notes: `${consumptionType}: ${areaToConsume.toFixed(2)} sqft (${rollsToConsume.toFixed(3)} rolls) from ${optimization.selectedWidth}ft width batch. Required: ${requiredWidth}ft × ${requiredLength}ft [Batch: ${batch.batchId}]`,
                createdBy: userId,
                transactionDate: new Date()
            });

            console.log(`[WireMesh] 📦 Consumed ${areaToConsume.toFixed(2)} sqft (${rollsToConsume.toFixed(3)} rolls) from ${optimization.selectedWidth}ft width batch ${batch.batchId}`);

            remainingAreaToConsume -= areaToConsume;
        }

        // Save material with updated batch quantities
        await material.save();

        // Create all transaction records using StockTransaction model directly  
        const StockTransaction = require('../models/StockTransaction');
        for (const txnData of transactionsToCreate) {
            await StockTransaction.create(txnData);
        }

        const totalWastage = (optimization.selectedWidth - requiredWidth) * requiredLength * quantity;
        const wastePercentage = (optimization.selectedWidth - requiredWidth) / optimization.selectedWidth * 100;
        
        console.log(`[WireMesh] ✅ Consumed total ${totalAreaNeeded} sqft with ${totalWastage.toFixed(2)} sqft wastage (${wastePercentage.toFixed(1)}%)`);

        return {
            success: true,
            totalAreaConsumed: totalAreaNeeded,
            totalWastage: totalWastage,
            wastePercentage: wastePercentage,
            optimalWidth: optimization.selectedWidth,
            averageEfficiency: 100 - wastePercentage,
            consumedBatches,
            optimization,
            material
        };
    }

    /**
     * Consume stock using FIFO/LIFO
     * @param {string} materialId 
     * @param {object} consumeData 
     * @returns {object} - Consumption details
     */
    static async consumeStock(materialId, consumeData) {
        const {
            companyId,
            length, lengthUnit, gauge,
            quantityNeeded,
            consumptionType = 'Production', // 'Production', 'Scrap', 'Transfer', etc.
            sortOrder = 'FIFO', // 'FIFO' or 'LIFO'
            notes,
            userId
        } = consumeData;

        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            throw new Error('Material not found or access denied');
        }

        // Find available batches
        const availableBatches = material.getAvailableBatches({
            length, lengthUnit, gauge, minQuantity: 0.001
        }, sortOrder);

        if (availableBatches.length === 0) {
            throw new Error(`No stock available for ${length}${lengthUnit}${gauge ? ` ${gauge}` : ''}`);
        }

        // Calculate total available
        const totalAvailable = availableBatches.reduce((sum, batch) => 
            sum + parseFloat(batch.currentQuantity.toString()), 0
        );

        if (totalAvailable < quantityNeeded) {
            throw new Error(`Insufficient stock. Required: ${quantityNeeded}, Available: ${totalAvailable}`);
        }

        let remainingToConsume = quantityNeeded;
        const consumedBatches = [];
        const transactionsToCreate = [];

        // Consume from batches
        for (const batch of availableBatches) {
            if (remainingToConsume <= 0) break;

            const available = parseFloat(batch.currentQuantity.toString());
            const toConsume = Math.min(remainingToConsume, available);

            // Update batch quantity
            const newQuantity = available - toConsume;
            batch.currentQuantity = mongoose.Types.Decimal128.fromString(String(newQuantity));

            // Mark as completed if fully consumed
            if (newQuantity <= 0.001) {
                batch.isCompleted = true;
            }

            // Calculate actual weight consumed (proportional) - only for profiles
            let actualWeightConsumed = null;
            if (material.category === 'Profile' && batch.actualTotalWeight) {
                const totalWeight = parseFloat(batch.actualTotalWeight.toString());
                const originalQty = parseFloat(batch.originalQuantity.toString());
                actualWeightConsumed = (totalWeight * toConsume / originalQty);
            }

            // Get the correct rate field based on material category
            const batchRate = material.category === 'Profile' 
                ? parseFloat(batch.ratePerPiece.toString())
                : parseFloat(batch.ratePerUnit.toString());

            consumedBatches.push({
                batchId: batch.batchId,
                quantityConsumed: toConsume,
                actualWeightConsumed,
                rate: batchRate,
                supplier: batch.supplier,
                purchaseDate: batch.purchaseDate,
                invoiceNumber: batch.invoiceNumber
            });

            // Prepare transaction record
            transactionsToCreate.push({
                companyId,
                materialId: material._id,
                batchId: batch.batchId,
                type: 'Outward-Manual',
                subType: consumptionType,
                quantityChange: -toConsume, // Negative for outward
                unitRateAtTransaction: batchRate,
                length: material.category === 'Profile' ? length : undefined,
                lengthUnit: material.category === 'Profile' ? lengthUnit : undefined,
                gauge: material.category === 'Profile' ? gauge : undefined,
                notes: notes || `${consumptionType}: ${toConsume} pieces from batch ${batch.batchId}`,
                createdBy: userId
            });

            console.log(`[BatchInventory] 📦 Consumed ${toConsume} pieces from batch ${batch.batchId} (${actualWeightConsumed?.toFixed(2) || 'N/A'}kg)`);

            remainingToConsume -= toConsume;
        }

        // Save material with updated batch quantities
        await material.save();

        // Create all transaction records
        for (const txnData of transactionsToCreate) {
            await this.createStockTransaction(txnData);
        }

        console.log(`[BatchInventory] ✅ Consumed total ${quantityNeeded} pieces across ${consumedBatches.length} batches`);

        return {
            success: true,
            totalConsumed: quantityNeeded,
            consumedBatches,
            material
        };
    }

    /**
     * Get detailed stock report for a material
     * @param {string} materialId 
     * @param {string} companyId 
     * @returns {object} - Stock report
     */
    static async getStockReport(materialId, companyId) {
        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            throw new Error('Material not found or access denied');
        }

        const stockSummary = material.getStockSummary();
        
        // Get active batches based on material category
        let activeBatches;
        if (material.category === 'Profile') {
            activeBatches = material.profileBatches.filter(b => b.isActive && !b.isCompleted);
        } else {
            activeBatches = material.simpleBatches.filter(b => b.isActive && !b.isCompleted);
        }

        // Convert aggregated totals to strings
        const aggregatedTotals = {
            totalCurrentStock: material.aggregatedTotals?.totalCurrentStock?.toString() || '0',
            totalCurrentWeight: material.aggregatedTotals?.totalCurrentWeight?.toString() || '0',
            totalCurrentValue: material.aggregatedTotals?.totalCurrentValue?.toString() || '0',
            averageRatePerPiece: material.aggregatedTotals?.averageRatePerPiece?.toString() || '0',
            averageRatePerKg: material.aggregatedTotals?.averageRatePerKg?.toString() || '0',
            lastUpdated: material.aggregatedTotals?.lastUpdated || new Date()
        };

        // Format batch data based on material category
        const formattedBatches = activeBatches.map(batch => {
            const baseBatchData = {
                batchId: batch.batchId,
                currentQuantity: batch.currentQuantity.toString(),
                originalQuantity: batch.originalQuantity.toString(),
                totalCostPaid: batch.totalCostPaid.toString(),
                supplier: batch.supplier,
                purchaseDate: batch.purchaseDate,
                invoiceNumber: batch.invoiceNumber,
                lotNumber: batch.lotNumber,
                isActive: batch.isActive,
                isCompleted: batch.isCompleted,
                utilizationPercent: ((parseFloat(batch.originalQuantity.toString()) - parseFloat(batch.currentQuantity.toString())) / parseFloat(batch.originalQuantity.toString()) * 100).toFixed(1)
            };

            if (material.category === 'Profile') {
                return {
                    ...baseBatchData,
                    length: batch.length ? batch.length.toString() : null,
                    lengthUnit: batch.lengthUnit,
                    gauge: batch.gauge,
                    actualTotalWeight: batch.actualTotalWeight?.toString(),
                    actualWeightUnit: batch.actualWeightUnit || 'kg',
                    ratePerPiece: batch.ratePerPiece.toString(),
                    ratePerKg: batch.ratePerKg?.toString()
                };
            } else if (material.category === 'Wire Mesh') {
                return {
                    ...baseBatchData,
                    selectedWidth: batch.selectedWidth?.toString(),
                    widthUnit: batch.widthUnit,
                    rollLength: batch.rollLength?.toString(),
                    rollLengthUnit: batch.rollLengthUnit,
                    areaPerRoll: batch.areaPerRoll?.toString(),
                    totalArea: batch.totalArea?.toString(),
                    areaUnit: batch.areaUnit,
                    ratePerUnit: batch.ratePerUnit.toString(), // Rate per roll
                    ratePerArea: batch.ratePerArea?.toString() // Rate per area unit
                };
            } else {
                return {
                    ...baseBatchData,
                    ratePerUnit: batch.ratePerUnit.toString()
                };
            }
        });

        return {
            material: {
                id: material._id,
                name: material.name,
                category: material.category,
                stockUnit: material.stockUnit,
                usageUnit: material.usageUnit
            },
            aggregatedTotals,
            stockSummary,
            activeBatches: formattedBatches,
            totalBatches: activeBatches.length,
            lastUpdated: aggregatedTotals.lastUpdated
        };
    }

    /**
     * Create stock transaction record
     * @param {object} txnData 
     */
    static async createStockTransaction(txnData) {
        const {
            companyId, materialId, batchId, type, subType,
            quantityChange, unitRateAtTransaction,
            length, lengthUnit, gauge, notes, createdBy
        } = txnData;

        const transaction = new StockTransaction({
            companyId,
            materialId,
            type,
            length: length ? mongoose.Types.Decimal128.fromString(String(length)) : undefined,
            lengthUnit,
            quantityChange: mongoose.Types.Decimal128.fromString(String(quantityChange)),
            quantityUnit: 'pcs', // Standardize for batch system
            unitRateAtTransaction: mongoose.Types.Decimal128.fromString(String(unitRateAtTransaction)),
            relatedDocumentType: 'BatchOperation',
            notes: `${notes} [Batch: ${batchId}]`,
            createdBy
        });

        await transaction.save();
        return transaction;
    }

    /**
     * Get batch history for a material
     * @param {string} materialId 
     * @param {string} companyId 
     * @param {object} filters 
     * @returns {Array} - Batch history
     */
    static async getBatchHistory(materialId, companyId, filters = {}) {
        const { startDate, endDate, supplier, gauge, includeCompleted = true } = filters;

        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            throw new Error('Material not found or access denied');
        }

        // Get batches based on material category
        let batches;
        if (material.category === 'Profile') {
            batches = [...material.profileBatches];
        } else {
            batches = [...material.simpleBatches];
        }

        // Apply filters
        if (!includeCompleted) {
            batches = batches.filter(b => b.isActive && !b.isCompleted);
        }
        if (startDate) {
            batches = batches.filter(b => b.purchaseDate >= new Date(startDate));
        }
        if (endDate) {
            batches = batches.filter(b => b.purchaseDate <= new Date(endDate));
        }
        if (supplier) {
            batches = batches.filter(b => b.supplier && b.supplier.toLowerCase().includes(supplier.toLowerCase()));
        }
        if (gauge && material.category === 'Profile') {
            batches = batches.filter(b => b.gauge === gauge);
        }

        // Format batch data based on material category
        return batches.map(batch => {
            const baseBatchData = {
                batchId: batch.batchId,
                originalQuantity: batch.originalQuantity.toString(),
                currentQuantity: batch.currentQuantity.toString(),
                totalCostPaid: batch.totalCostPaid.toString(),
                supplier: batch.supplier,
                purchaseDate: batch.purchaseDate,
                invoiceNumber: batch.invoiceNumber,
                lotNumber: batch.lotNumber,
                isActive: batch.isActive,
                isCompleted: batch.isCompleted,
                utilizationPercent: ((parseFloat(batch.originalQuantity.toString()) - parseFloat(batch.currentQuantity.toString())) / parseFloat(batch.originalQuantity.toString()) * 100).toFixed(1)
            };

            if (material.category === 'Profile') {
                return {
                    ...baseBatchData,
                    length: batch.length ? batch.length.toString() : null,
                    lengthUnit: batch.lengthUnit,
                    gauge: batch.gauge,
                    actualTotalWeight: batch.actualTotalWeight?.toString(),
                    ratePerPiece: batch.ratePerPiece.toString(),
                    ratePerKg: batch.ratePerKg?.toString()
                };
            } else if (material.category === 'Wire Mesh') {
                return {
                    ...baseBatchData,
                    selectedWidth: batch.selectedWidth?.toString(),
                    widthUnit: batch.widthUnit,
                    rollLength: batch.rollLength?.toString(),
                    rollLengthUnit: batch.rollLengthUnit,
                    areaPerRoll: batch.areaPerRoll?.toString(),
                    totalArea: batch.totalArea?.toString(),
                    areaUnit: batch.areaUnit,
                    ratePerUnit: batch.ratePerUnit.toString(), // Rate per roll
                    ratePerArea: batch.ratePerArea?.toString() // Rate per area unit
                };
            } else {
                return {
                    ...baseBatchData,
                    ratePerUnit: batch.ratePerUnit.toString()
                };
            }
        }).sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    }

    /**
     * Create a new material with predefined lengths and gauges
     * @param {string} companyId 
     * @param {string} userId 
     * @param {object} data - Simplified material data
     * @returns {object} - Created material details
     */
    static async createSimplifiedMaterial(companyId, userId, data) {
        const {
            name, category, stockUnit, usageUnit,
            standardLengths, gauges, standardWidths, supplier, brand, 
            hsnCode, description
        } = data;

        // Check if material with same name already exists
        const existingMaterial = await MaterialV2.findOne({ 
            companyId, 
            name: name.trim() 
        });

        if (existingMaterial) {
            throw new Error(`Material with name "${name}" already exists`);
        }

        // Create material with predefined structure
        const materialData = {
            companyId,
            name: name.trim(),
            category,
            stockUnit,
            usageUnit,
            // Handle standardLengths based on material category
            standardLengths: (() => {
                if (category === 'Wire Mesh' && standardWidths && standardWidths.length > 0) {
                    // For Wire Mesh, store standardWidths as standardLengths
                    return standardWidths.map(sw => ({
                        length: new Decimal(sw.width.toString()), // Store width as length for consistency
                        unit: sw.unit
                    }));
                } else if (standardLengths && standardLengths.length > 0) {
                    // For Profile materials, use regular standardLengths
                    return standardLengths.map(sl => ({
                        length: new Decimal(sl.length.toString()),
                        unit: sl.unit
                    }));
                } else {
                    // For other materials, empty array
                    return [];
                }
            })(),
            // Only add gauges for Profile materials (without weights initially)
            referenceGaugeWeights: category === 'Profile' && gauges && gauges.length > 0 ? gauges.map(g => ({
                gauge: g.gauge,
                referenceWeight: new Decimal('0'), // Will be calculated during stock inward
                unitLength: 'ft'
            })) : [],
            // Initialize empty stock batches using new structure
            profileBatches: [], // For Profile materials
            simpleBatches: [], // For non-Profile materials
            // Include general material information
            supplier: supplier || undefined,
            brand: brand || undefined,
            hsnCode: hsnCode || undefined,
            description: description || undefined,
            // Initialize aggregated totals
            aggregatedTotals: {
                totalCurrentStock: new Decimal('0'),
                totalCurrentWeight: new Decimal('0'),
                totalCurrentValue: new Decimal('0'),
                averageRatePerPiece: new Decimal('0'),
                averageRatePerKg: new Decimal('0'),
                lastUpdated: new Date()
            },
            isActive: true,
            migrationStatus: 'native',
            createdBy: userId,
            updatedBy: userId
        };

        const material = new MaterialV2(materialData);
        await material.save();

        console.log(`[BatchInventoryService] Created simplified material: ${name} (ID: ${material._id}) with category: ${category}${category === 'Wire Mesh' && standardWidths && standardWidths.length > 0 ? ` with ${standardWidths.length} standard widths` : category === 'Profile' && standardLengths && standardLengths.length > 0 ? ` with ${standardLengths.length} standard lengths` : ''}`);

        // Convert to response format
        return {
            id: material._id.toString(),
            name: material.name,
            category: material.category,
            stockUnit: material.stockUnit,
            usageUnit: material.usageUnit,
            supplier: material.supplier,
            brand: material.brand,
            hsnCode: material.hsnCode,
            description: material.description,
            aggregatedTotals: {
                totalCurrentStock: material.aggregatedTotals.totalCurrentStock.toString(),
                totalCurrentWeight: material.aggregatedTotals.totalCurrentWeight.toString(),
                totalCurrentValue: material.aggregatedTotals.totalCurrentValue.toString(),
                averageRatePerPiece: material.aggregatedTotals.averageRatePerPiece.toString(),
                averageRatePerKg: material.aggregatedTotals.averageRatePerKg.toString(),
                lastUpdated: material.aggregatedTotals.lastUpdated.toISOString()
            },
            activeBatchCount: 0, // No batches initially
            hasLowStock: false,
            systemType: 'v2',
            // Include configuration data for simplified forms
            standardLengths: material.standardLengths ? material.standardLengths.map(sl => ({
                length: sl.length.toString(),
                unit: sl.unit
            })) : undefined,
            referenceGaugeWeights: material.referenceGaugeWeights ? material.referenceGaugeWeights.map(g => ({
                gauge: g.gauge,
                referenceWeight: g.referenceWeight.toString(),
                unitLength: g.unitLength
            })) : undefined
        };
    }

    /**
     * Delete a material (only if no active batches exist)
     * @param {string} materialId 
     * @param {string} companyId 
     * @returns {object} - Deletion result
     */
    static async deleteMaterial(materialId, companyId) {
        // Find the material
        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            throw new Error('Material not found or access denied');
        }

        // Check if material has any active batches
        const hasActiveBatches = (material.profileBatches && material.profileBatches.some(b => b.isActive && !b.isCompleted)) ||
                                (material.simpleBatches && material.simpleBatches.some(b => b.isActive && !b.isCompleted));

        if (hasActiveBatches) {
            throw new Error(`Cannot delete material "${material.name}" because it has active batches. Please consume or mark all batches as completed first.`);
        }

        // Check if material has any stock remaining
        const currentStock = parseFloat(material.aggregatedTotals?.totalCurrentStock?.toString() || '0');
        if (currentStock > 0) {
            throw new Error(`Cannot delete material "${material.name}" because it still has ${currentStock} ${material.stockUnit} in stock. Please consume all stock first.`);
        }

        // Perform the deletion
        await MaterialV2.findByIdAndDelete(materialId);

        console.log(`[BatchInventory] 🗑️ Deleted material: ${material.name} (ID: ${materialId})`);

        return {
            message: `Material "${material.name}" deleted successfully`,
            deletedMaterialId: materialId
        };
    }
}

module.exports = BatchInventoryService; 