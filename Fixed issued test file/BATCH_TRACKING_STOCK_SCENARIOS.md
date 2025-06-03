# Batch Tracking: Stock Scenarios & Intelligent Ordering

## Overview

This document addresses critical real-world scenarios in the batch tracking system, including zero stock situations, gauge availability, intelligent stock ordering proposals, and vendor management.

## Scenario 1: Zero Stock Available

### Current Challenge
When no batches are available for a specific material+gauge+length combination, the system needs to:
- Detect the shortage
- Provide alternatives
- Suggest ordering options
- Allow estimation/quotation to continue with warnings

### Proposed Solution: Intelligent Stock Management

#### 1.1 Enhanced Stock Availability Check

```javascript
// Enhanced BatchService with zero stock handling
class BatchService {
    static async checkStockAvailability(materialId, requirements) {
        const { gauge, length, quantityNeeded } = requirements;
        
        // Get available batches for this specific combination
        const availableBatches = await this.getAvailableBatches(materialId, {
            gauge: gauge,
            length: length,
            hasStock: true // Only non-zero quantities
        });
        
        const totalAvailable = availableBatches.reduce(
            (sum, batch) => sum + parseFloat(batch.quantity.toString()), 0
        );
        
        return {
            isAvailable: totalAvailable >= quantityNeeded,
            availableQuantity: totalAvailable,
            shortfall: Math.max(0, quantityNeeded - totalAvailable),
            availableBatches: availableBatches,
            alternatives: await this.findAlternatives(materialId, requirements),
            orderSuggestion: await this.generateOrderSuggestion(materialId, requirements)
        };
    }
    
    static async findAlternatives(materialId, requirements) {
        const material = await Material.findById(materialId);
        const alternatives = [];
        
        // 1. Same material, same length, different gauge
        const alternativeGauges = await this.getAvailableBatches(materialId, {
            length: requirements.length,
            gauge: { $ne: requirements.gauge },
            hasStock: true
        });
        
        if (alternativeGauges.length > 0) {
            alternatives.push({
                type: 'alternative_gauge',
                description: `Same material, same length (${requirements.length}ft), different gauge`,
                options: alternativeGauges.map(batch => ({
                    gauge: batch.gauge,
                    availableQuantity: batch.quantity,
                    unitRate: batch.unitRate,
                    batchId: batch.batchId
                }))
            });
        }
        
        // 2. Same material, same gauge, different length
        const alternativeLengths = await this.getAvailableBatches(materialId, {
            gauge: requirements.gauge,
            length: { $ne: requirements.length },
            hasStock: true
        });
        
        if (alternativeLengths.length > 0) {
            alternatives.push({
                type: 'alternative_length',
                description: `Same material, same gauge (${requirements.gauge}), different length`,
                options: alternativeLengths.map(batch => ({
                    length: batch.length,
                    availableQuantity: batch.quantity,
                    unitRate: batch.unitRate,
                    batchId: batch.batchId,
                    wastageEstimate: this.calculateWastage(requirements.length, batch.length)
                }))
            });
        }
        
        // 3. Similar materials (same category, similar properties)
        const similarMaterials = await this.findSimilarMaterials(material, requirements);
        if (similarMaterials.length > 0) {
            alternatives.push({
                type: 'similar_materials',
                description: 'Similar materials that could work as substitutes',
                options: similarMaterials
            });
        }
        
        return alternatives;
    }
}
```

#### 1.2 Stock Shortage Alerts

```javascript
// Real-time stock monitoring
class StockAlertService {
    static async checkLowStock(companyId) {
        const materials = await Material.find({ companyId });
        const alerts = [];
        
        for (const material of materials) {
            const batchSummary = await BatchService.getBatchSummary(material._id);
            
            // Check each gauge+length combination
            for (const combination of batchSummary.combinations) {
                if (combination.totalQuantity <= combination.lowStockThreshold) {
                    alerts.push({
                        type: combination.totalQuantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
                        materialId: material._id,
                        materialName: material.name,
                        gauge: combination.gauge,
                        length: combination.length,
                        currentStock: combination.totalQuantity,
                        threshold: combination.lowStockThreshold,
                        recommendedOrder: this.calculateRecommendedOrder(material, combination),
                        lastUsage: await this.getLastUsageDate(material._id, combination),
                        averageMonthlyUsage: await this.getAverageUsage(material._id, combination)
                    });
                }
            }
        }
        
        return alerts;
    }
}
```

## Scenario 2: Product Default Gauge (20G) Not Available

### Current Challenge
Products are configured with default gauge (e.g., 20G), but when creating orders/estimations, that specific gauge might not be in stock.

### Proposed Solution: Intelligent Gauge Selection

#### 2.1 Enhanced Product Cost Calculation

```javascript
// Updated productService with gauge fallback logic
class ProductService {
    static async calculateProductCostWithGaugeHandling(productId, companyId, width, height, preferredGauge = null) {
        const product = await ProductType.findById(productId).populate('materials.materialId');
        const costBreakdown = [];
        let totalCost = 0;
        const warnings = [];
        
        for (const materialLink of product.materials) {
            const material = materialLink.materialId;
            
            if (material.category === 'Profile') {
                // Determine gauge preference order
                const gaugePreference = [
                    preferredGauge || materialLink.defaultGauge || '20G',
                    '18G', '20G', '22G', '24G' // Common gauges in preference order
                ].filter(Boolean);
                
                let selectedGauge = null;
                let availabilityInfo = null;
                
                // Try each gauge in preference order
                for (const gauge of gaugePreference) {
                    const availability = await BatchService.checkStockAvailability(material._id, {
                        gauge: gauge,
                        length: 15, // Standard length check
                        quantityNeeded: 1 // Minimum check
                    });
                    
                    if (availability.isAvailable) {
                        selectedGauge = gauge;
                        availabilityInfo = availability;
                        break;
                    }
                }
                
                if (!selectedGauge) {
                    // No preferred gauges available, find any available gauge
                    const alternatives = await BatchService.findAlternatives(material._id, {
                        gauge: gaugePreference[0],
                        length: 15,
                        quantityNeeded: 1
                    });
                    
                    if (alternatives.length > 0 && alternatives[0].options.length > 0) {
                        selectedGauge = alternatives[0].options[0].gauge;
                        warnings.push({
                            type: 'GAUGE_SUBSTITUTION',
                            message: `Material ${material.name}: Using ${selectedGauge} instead of preferred ${gaugePreference[0]}`,
                            materialId: material._id,
                            originalGauge: gaugePreference[0],
                            substitutedGauge: selectedGauge
                        });
                    } else {
                        // No stock at all - create order suggestion
                        warnings.push({
                            type: 'OUT_OF_STOCK',
                            message: `Material ${material.name}: No stock available for any gauge`,
                            materialId: material._id,
                            orderSuggestion: await this.generateStockOrderSuggestion(material._id, gaugePreference[0])
                        });
                        continue;
                    }
                }
                
                // Calculate cost with selected gauge
                const materialCost = await this.calculateMaterialCost(
                    material, materialLink, width, height, selectedGauge
                );
                
                costBreakdown.push({
                    ...materialCost,
                    selectedGauge: selectedGauge,
                    requestedGauge: gaugePreference[0],
                    wasSubstituted: selectedGauge !== gaugePreference[0]
                });
                
                totalCost += materialCost.cost;
            }
        }
        
        return {
            totalCost,
            breakdown: costBreakdown,
            warnings: warnings,
            stockStatus: warnings.length > 0 ? 'ISSUES_DETECTED' : 'ADEQUATE'
        };
    }
}
```

#### 2.2 Gauge Substitution Rules

```javascript
// Gauge compatibility and substitution rules
class GaugeService {
    static getGaugeSubstitutionRules() {
        return {
            '18G': {
                canSubstituteFor: ['20G'],
                costAdjustment: 1.1, // 10% higher cost
                strengthNote: 'Stronger than specified gauge'
            },
            '20G': {
                canSubstituteFor: ['18G', '22G'],
                costAdjustment: 1.0,
                strengthNote: 'Standard gauge'
            },
            '22G': {
                canSubstituteFor: ['20G', '24G'],
                costAdjustment: 0.9, // 10% lower cost
                strengthNote: 'Lighter than specified gauge'
            },
            '24G': {
                canSubstituteFor: ['22G'],
                costAdjustment: 0.8,
                strengthNote: 'Much lighter - verify suitability'
            }
        };
    }
    
    static isSubstitutionAcceptable(requestedGauge, availableGauge, applicationContext) {
        const rules = this.getGaugeSubstitutionRules();
        const requestedRule = rules[requestedGauge];
        const availableRule = rules[availableGauge];
        
        if (!requestedRule || !availableRule) return false;
        
        // Check if substitution is allowed
        if (requestedRule.canSubstituteFor.includes(availableGauge)) {
            return {
                acceptable: true,
                direction: 'upgrade', // Using stronger gauge
                costImpact: availableRule.costAdjustment / requestedRule.costAdjustment,
                note: availableRule.strengthNote
            };
        }
        
        if (availableRule.canSubstituteFor.includes(requestedGauge)) {
            return {
                acceptable: applicationContext.allowDowngrade !== false,
                direction: 'downgrade', // Using lighter gauge
                costImpact: availableRule.costAdjustment / requestedRule.costAdjustment,
                note: availableRule.strengthNote,
                warning: 'Verify structural requirements'
            };
        }
        
        return { acceptable: false, reason: 'No substitution rule defined' };
    }
}
```

## Scenario 3: Order Stock Availability Check

### Proposed Solution: Comprehensive Order Validation

#### 3.1 Pre-Order Stock Validation

```javascript
// Enhanced order validation with stock checking
class OrderService {
    static async validateOrderStock(orderData, companyId) {
        const stockValidation = {
            canProceed: true,
            issues: [],
            alternatives: [],
            orderSuggestions: [],
            estimatedDelay: null
        };
        
        // Calculate all required materials for this order
        const materialRequirements = await this.calculateOrderMaterialRequirements(orderData);
        
        for (const requirement of materialRequirements) {
            const availability = await BatchService.checkStockAvailability(
                requirement.materialId, 
                requirement.specs
            );
            
            if (!availability.isAvailable) {
                stockValidation.canProceed = false;
                stockValidation.issues.push({
                    type: 'INSUFFICIENT_STOCK',
                    materialId: requirement.materialId,
                    materialName: requirement.materialName,
                    required: requirement.specs.quantityNeeded,
                    available: availability.availableQuantity,
                    shortfall: availability.shortfall,
                    gauge: requirement.specs.gauge,
                    length: requirement.specs.length
                });
                
                // Add alternatives if available
                if (availability.alternatives.length > 0) {
                    stockValidation.alternatives.push({
                        originalRequirement: requirement,
                        alternatives: availability.alternatives
                    });
                }
                
                // Add order suggestion
                if (availability.orderSuggestion) {
                    stockValidation.orderSuggestions.push(availability.orderSuggestion);
                }
            }
        }
        
        // Calculate estimated delay if stock needs to be ordered
        if (stockValidation.orderSuggestions.length > 0) {
            stockValidation.estimatedDelay = await this.calculateOrderDelay(
                stockValidation.orderSuggestions
            );
        }
        
        return stockValidation;
    }
    
    static async suggestOrderModifications(orderValidation) {
        const suggestions = [];
        
        for (const alternative of orderValidation.alternatives) {
            // Suggest gauge substitution
            const gaugeAlternatives = alternative.alternatives.find(
                alt => alt.type === 'alternative_gauge'
            );
            
            if (gaugeAlternatives) {
                suggestions.push({
                    type: 'GAUGE_SUBSTITUTION',
                    originalGauge: alternative.originalRequirement.specs.gauge,
                    suggestedGauge: gaugeAlternatives.options[0].gauge,
                    costImpact: this.calculateCostImpact(alternative, gaugeAlternatives.options[0]),
                    message: `Use ${gaugeAlternatives.options[0].gauge} instead of ${alternative.originalRequirement.specs.gauge}`,
                    autoApplicable: true
                });
            }
            
            // Suggest length alternatives with cutting plan
            const lengthAlternatives = alternative.alternatives.find(
                alt => alt.type === 'alternative_length'
            );
            
            if (lengthAlternatives) {
                const bestLengthOption = this.findBestLengthAlternative(
                    alternative.originalRequirement.specs.length,
                    lengthAlternatives.options
                );
                
                suggestions.push({
                    type: 'LENGTH_SUBSTITUTION',
                    originalLength: alternative.originalRequirement.specs.length,
                    suggestedLength: bestLengthOption.length,
                    wastage: bestLengthOption.wastageEstimate,
                    costImpact: bestLengthOption.costImpact,
                    message: `Use ${bestLengthOption.length}ft pipes (${bestLengthOption.wastageEstimate}% wastage)`,
                    autoApplicable: bestLengthOption.wastageEstimate < 15 // Auto-apply if wastage < 15%
                });
            }
        }
        
        return suggestions;
    }
}
```

## Scenario 4: Intelligent Stock Ordering Proposals

### Proposed Solution: Smart Procurement System

#### 4.1 Automated Stock Order Generation

```javascript
class ProcurementService {
    static async generateStockOrderProposal(companyId, trigger = 'MANUAL') {
        const lowStockAlerts = await StockAlertService.checkLowStock(companyId);
        const upcomingOrders = await this.getUpcomingOrderRequirements(companyId);
        const orderProposal = {
            trigger: trigger,
            generatedAt: new Date(),
            items: [],
            suppliers: {},
            totalEstimatedCost: 0,
            urgencyLevel: 'NORMAL'
        };
        
        // Combine low stock alerts with upcoming requirements
        const consolidatedRequirements = this.consolidateRequirements(
            lowStockAlerts, 
            upcomingOrders
        );
        
        for (const requirement of consolidatedRequirements) {
            const orderItem = await this.createOrderItem(requirement);
            
            if (orderItem) {
                orderProposal.items.push(orderItem);
                
                // Group by supplier
                const supplierId = orderItem.preferredSupplier.id;
                if (!orderProposal.suppliers[supplierId]) {
                    orderProposal.suppliers[supplierId] = {
                        supplier: orderItem.preferredSupplier,
                        items: [],
                        totalCost: 0
                    };
                }
                
                orderProposal.suppliers[supplierId].items.push(orderItem);
                orderProposal.suppliers[supplierId].totalCost += orderItem.estimatedTotalCost;
                orderProposal.totalEstimatedCost += orderItem.estimatedTotalCost;
            }
        }
        
        // Determine urgency
        orderProposal.urgencyLevel = this.calculateUrgencyLevel(orderProposal.items);
        
        return orderProposal;
    }
    
    static async createOrderItem(requirement) {
        const material = await Material.findById(requirement.materialId);
        const suppliers = await this.findSuppliersForMaterial(material, requirement);
        
        if (suppliers.length === 0) {
            return null; // No suppliers found - will be handled separately
        }
        
        // Calculate optimal order quantity
        const optimalQuantity = this.calculateOptimalOrderQuantity({
            currentStock: requirement.currentStock,
            monthlyUsage: requirement.averageMonthlyUsage,
            minimumOrderQuantity: suppliers[0].minimumOrderQuantity,
            leadTime: suppliers[0].leadTimeDays,
            safetyStock: requirement.safetyStockLevel
        });
        
        return {
            materialId: material._id,
            materialName: material.name,
            gauge: requirement.gauge,
            length: requirement.length,
            unit: requirement.unit,
            currentStock: requirement.currentStock,
            recommendedQuantity: optimalQuantity,
            urgencyReason: requirement.urgencyReason,
            preferredSupplier: suppliers[0],
            alternativeSuppliers: suppliers.slice(1),
            estimatedUnitCost: suppliers[0].lastPurchaseRate || suppliers[0].quotedRate,
            estimatedTotalCost: optimalQuantity * (suppliers[0].lastPurchaseRate || suppliers[0].quotedRate),
            expectedDelivery: this.calculateExpectedDelivery(suppliers[0].leadTimeDays),
            notes: this.generateOrderNotes(requirement, optimalQuantity)
        };
    }
}
```

#### 4.2 Supplier Management Integration

```javascript
class SupplierService {
    static async findSuppliersForMaterial(material, requirements) {
        // First, try to find suppliers who have supplied this exact material before
        const directSuppliers = await this.findDirectSuppliers(material._id, requirements);
        
        // If no direct suppliers, find suppliers for similar materials
        const similarMaterialSuppliers = await this.findSimilarMaterialSuppliers(material, requirements);
        
        // If still no suppliers, find general aluminium profile suppliers
        const generalSuppliers = await this.findGeneralSuppliers(material.category);
        
        const allSuppliers = [
            ...directSuppliers,
            ...similarMaterialSuppliers,
            ...generalSuppliers
        ];
        
        // Remove duplicates and rank by preference
        return this.rankSuppliers(allSuppliers, material, requirements);
    }
    
    static async rankSuppliers(suppliers, material, requirements) {
        return suppliers.map(supplier => ({
            ...supplier,
            score: this.calculateSupplierScore(supplier, material, requirements)
        })).sort((a, b) => b.score - a.score);
    }
    
    static calculateSupplierScore(supplier, material, requirements) {
        let score = 0;
        
        // Historical performance
        score += supplier.onTimeDeliveryRate * 30;
        score += supplier.qualityRating * 25;
        
        // Cost competitiveness
        if (supplier.lastPurchaseRate) {
            const avgMarketRate = this.getAverageMarketRate(material);
            const costAdvantage = Math.max(0, (avgMarketRate - supplier.lastPurchaseRate) / avgMarketRate);
            score += costAdvantage * 20;
        }
        
        // Availability and lead time
        score += Math.max(0, (30 - supplier.leadTimeDays) / 30) * 15;
        
        // Material match
        if (supplier.hasExactMaterial) score += 10;
        
        return score;
    }
}
```

## Scenario 5: Vendor Length/Gauge Unavailability

### Proposed Solution: Alternative Sourcing & Substitution

#### 5.1 Multi-Tier Sourcing Strategy

```javascript
class AlternativeSourcingService {
    static async handleUnavailableSpecs(materialId, unavailableSpecs) {
        const strategies = [];
        
        // Strategy 1: Alternative lengths from same supplier
        const lengthAlternatives = await this.findAlternativeLengths(
            materialId, 
            unavailableSpecs
        );
        
        if (lengthAlternatives.length > 0) {
            strategies.push({
                type: 'ALTERNATIVE_LENGTHS',
                description: 'Use different length from same supplier with cutting plan',
                options: lengthAlternatives.map(alt => ({
                    availableLength: alt.length,
                    supplier: alt.supplier,
                    costPerPiece: alt.costPerPiece,
                    cuttingPlan: this.generateCuttingPlan(unavailableSpecs.length, alt.length),
                    totalCostImpact: this.calculateLengthSubstitutionCost(unavailableSpecs, alt),
                    leadTime: alt.leadTime
                }))
            });
        }
        
        // Strategy 2: Alternative gauges
        const gaugeAlternatives = await this.findAlternativeGauges(
            materialId, 
            unavailableSpecs
        );
        
        if (gaugeAlternatives.length > 0) {
            strategies.push({
                type: 'ALTERNATIVE_GAUGES',
                description: 'Use different gauge with engineering approval',
                options: gaugeAlternatives.map(alt => ({
                    availableGauge: alt.gauge,
                    supplier: alt.supplier,
                    costPerPiece: alt.costPerPiece,
                    structuralImpact: this.assessStructuralImpact(unavailableSpecs.gauge, alt.gauge),
                    requiresApproval: this.requiresEngineeringApproval(unavailableSpecs.gauge, alt.gauge),
                    leadTime: alt.leadTime
                }))
            });
        }
        
        // Strategy 3: Alternative suppliers
        const alternativeSuppliers = await this.findAlternativeSuppliers(
            materialId, 
            unavailableSpecs
        );
        
        if (alternativeSuppliers.length > 0) {
            strategies.push({
                type: 'ALTERNATIVE_SUPPLIERS',
                description: 'Source exact specifications from different suppliers',
                options: alternativeSuppliers
            });
        }
        
        // Strategy 4: Custom manufacturing/cutting
        const customOptions = await this.findCustomManufacturingOptions(
            materialId, 
            unavailableSpecs
        );
        
        if (customOptions.length > 0) {
            strategies.push({
                type: 'CUSTOM_MANUFACTURING',
                description: 'Custom cut/manufacture to exact specifications',
                options: customOptions
            });
        }
        
        return {
            originalSpecs: unavailableSpecs,
            strategies: strategies,
            recommendation: this.selectBestStrategy(strategies),
            fallbackPlan: await this.createFallbackPlan(materialId, unavailableSpecs)
        };
    }
    
    static generateCuttingPlan(requiredLength, availableLength) {
        const required = parseFloat(requiredLength);
        const available = parseFloat(availableLength);
        
        if (available >= required) {
            return {
                piecesPerPipe: Math.floor(available / required),
                wastagePerPipe: available % required,
                wastagePercentage: ((available % required) / available) * 100,
                efficiency: (Math.floor(available / required) * required) / available * 100
            };
        } else {
            return {
                piecesPerPipe: 0,
                wastagePerPipe: 0,
                wastagePercentage: 0,
                efficiency: 0,
                note: `Available length (${available}ft) is shorter than required (${required}ft)`
            };
        }
    }
}
```

#### 5.2 Emergency Procurement Protocol

```javascript
class EmergencyProcurementService {
    static async handleCriticalShortage(materialId, urgentRequirements) {
        const protocol = {
            level: this.assessCriticalityLevel(urgentRequirements),
            actions: [],
            timeline: {},
            approvals: []
        };
        
        // Level 1: Standard alternative sourcing
        if (protocol.level >= 1) {
            protocol.actions.push({
                action: 'ALTERNATIVE_SOURCING',
                description: 'Contact alternative suppliers for immediate availability',
                timeline: '2-4 hours',
                responsible: 'Procurement Team'
            });
        }
        
        // Level 2: Express procurement
        if (protocol.level >= 2) {
            protocol.actions.push({
                action: 'EXPRESS_PROCUREMENT',
                description: 'Arrange express delivery from any available supplier',
                timeline: '24-48 hours',
                costImpact: 'High (express charges apply)',
                responsible: 'Senior Procurement Manager'
            });
        }
        
        // Level 3: Emergency substitution
        if (protocol.level >= 3) {
            protocol.actions.push({
                action: 'EMERGENCY_SUBSTITUTION',
                description: 'Use alternative materials with engineering approval',
                timeline: '1-2 hours',
                responsible: 'Engineering + Production Manager',
                requiresApproval: true
            });
        }
        
        // Level 4: Order modification
        if (protocol.level >= 4) {
            protocol.actions.push({
                action: 'ORDER_MODIFICATION',
                description: 'Contact customer for delivery delay or specification change',
                timeline: 'Immediate',
                responsible: 'Sales Manager',
                customerImpact: true
            });
        }
        
        return protocol;
    }
}
```

## Implementation in Batch Tracking System

### Enhanced API Endpoints

```javascript
// Additional endpoints for stock scenarios
router.get('/api/inventory/stock-alerts/:companyId', async (req, res) => {
    const alerts = await StockAlertService.checkLowStock(req.params.companyId);
    res.json(alerts);
});

router.post('/api/inventory/validate-order-stock', async (req, res) => {
    const validation = await OrderService.validateOrderStock(req.body, req.user.companyId);
    res.json(validation);
});

router.post('/api/procurement/generate-order-proposal', async (req, res) => {
    const proposal = await ProcurementService.generateStockOrderProposal(req.user.companyId);
    res.json(proposal);
});

router.post('/api/inventory/find-alternatives', async (req, res) => {
    const alternatives = await AlternativeSourcingService.handleUnavailableSpecs(
        req.body.materialId, 
        req.body.specs
    );
    res.json(alternatives);
});
```

### Database Schema Additions

```javascript
// Supplier schema for procurement management
const supplierSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    contactInfo: {
        phone: String,
        email: String,
        address: String
    },
    materials: [{
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
        availableGauges: [String],
        availableLengths: [Number],
        leadTimeDays: { type: Number, default: 7 },
        minimumOrderQuantity: Number,
        lastPurchaseRate: mongoose.Types.Decimal128,
        lastPurchaseDate: Date
    }],
    performance: {
        onTimeDeliveryRate: { type: Number, default: 100 },
        qualityRating: { type: Number, default: 5 },
        totalOrders: { type: Number, default: 0 },
        lastOrderDate: Date
    },
    isActive: { type: Boolean, default: true }
});

// Stock alert preferences
const stockAlertSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    gauge: String,
    length: mongoose.Types.Decimal128,
    lowStockThreshold: { type: mongoose.Types.Decimal128, required: true },
    reorderQuantity: mongoose.Types.Decimal128,
    autoOrderEnabled: { type: Boolean, default: false },
    alertChannels: [{
        type: { type: String, enum: ['email', 'sms', 'dashboard'] },
        enabled: { type: Boolean, default: true }
    }]
});
```

## Summary

This comprehensive approach handles all the critical stock scenarios you mentioned:

1. **Zero Stock Detection**: Intelligent checking with alternatives and ordering suggestions
2. **Gauge Substitution**: Smart fallback when default 20G is unavailable
3. **Order Validation**: Pre-order stock checking with modification suggestions
4. **Automated Procurement**: Smart stock ordering based on usage patterns
5. **Vendor Unavailability**: Multi-tier sourcing strategies and emergency protocols

The system becomes proactive rather than reactive, helping users make informed decisions when stock issues arise while maintaining operational continuity.

Would you like me to elaborate on any specific scenario or start implementing any of these features? 