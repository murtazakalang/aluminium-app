const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const Client = require('../models/Client');
const Setting = require('../models/Setting');
const ProductType = require('../models/ProductType');

/**
 * Service for quotation-related business logic and calculations
 */
class QuotationService {
    
    /**
     * Generate unique quotation ID display
     * @param {string} companyId - Company ID
     * @returns {Promise<string>} - Unique quotation ID like Q-2024-001
     */
    static async generateQuotationId(companyId) {
        const currentYear = new Date().getFullYear();
        const prefix = `Q-${currentYear}-`;
        
        // Find the highest quotation number for this year and company
        const lastQuotation = await Quotation.findOne({
            companyId,
            quotationIdDisplay: { $regex: `^${prefix}` }
        }).sort({ quotationIdDisplay: -1 });
        
        let nextNumber = 1;
        if (lastQuotation) {
            const lastNumber = parseInt(lastQuotation.quotationIdDisplay.split('-')[2]);
            nextNumber = lastNumber + 1;
        }
        
        return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
    }
    
    /**
     * Calculate area with proper unit conversion, rounding, and minimum rules
     * @param {number} width - Width value
     * @param {number} height - Height value
     * @param {string} dimensionUnit - Input dimension unit (inches, mm)
     * @param {string} areaUnit - Output area unit (sqft, sqm)
     * @param {string} roundingRule - Rounding rule (nearest_0.25, nearest_0.5, etc.)
     * @param {number} minimumArea - Minimum chargeable area
     * @returns {Object} - Object with rawArea, roundedArea, chargeableArea
     */
    static calculateArea(width, height, dimensionUnit, areaUnit, roundingRule, minimumArea = 0) {
        // Convert inputs to numbers if they're Decimal128
        const w = typeof width === 'number' ? width : parseFloat(width.toString());
        const h = typeof height === 'number' ? height : parseFloat(height.toString());
        const minArea = typeof minimumArea === 'number' ? minimumArea : parseFloat(minimumArea.toString());
        
        // Calculate raw area based on dimension unit
        let rawArea;
        if (dimensionUnit === 'inches' && areaUnit === 'sqft') {
            rawArea = (w * h) / 144; // Convert square inches to square feet
        } else if (dimensionUnit === 'mm' && areaUnit === 'sqm') {
            rawArea = (w * h) / 1000000; // Convert square mm to square meters
        } else if (dimensionUnit === 'inches' && areaUnit === 'sqm') {
            // Convert inches to meters first, then calculate area
            const wInMeters = w * 0.0254;
            const hInMeters = h * 0.0254;
            rawArea = wInMeters * hInMeters;
        } else if (dimensionUnit === 'mm' && areaUnit === 'sqft') {
            // Convert mm to feet first, then calculate area
            const wInFeet = w / 304.8;
            const hInFeet = h / 304.8;
            rawArea = wInFeet * hInFeet;
        } else {
            throw new Error(`Unsupported unit conversion: ${dimensionUnit} to ${areaUnit}`);
        }
        
        // Apply rounding rule
        let roundedArea = rawArea;
        if (roundingRule) {
            const roundingValue = parseFloat(roundingRule.split('_')[1]);
            roundedArea = Math.ceil(rawArea / roundingValue) * roundingValue;
        }
        
        // Apply minimum area rule
        const chargeableArea = Math.max(roundedArea, minArea);
        
        return {
            rawArea: mongoose.Types.Decimal128.fromString(rawArea.toFixed(4)),
            roundedArea: mongoose.Types.Decimal128.fromString(roundedArea.toFixed(4)),
            chargeableArea: mongoose.Types.Decimal128.fromString(chargeableArea.toFixed(4))
        };
    }
    
    /**
     * Calculate item totals for a quotation item
     * @param {Object} item - Quotation item
     * @param {string} dimensionUnit - Dimension unit
     * @param {string} areaUnit - Area unit
     * @param {string} roundingRule - Rounding rule
     * @param {number} minimumArea - Minimum area
     * @returns {Object} - Updated item with calculated values
     */
    static calculateItemTotals(item, dimensionUnit, areaUnit, roundingRule, minimumArea) {
        const areaCalc = this.calculateArea(
            item.width,
            item.height,
            dimensionUnit,
            areaUnit,
            roundingRule,
            minimumArea
        );
        
        item.rawAreaPerItem = areaCalc.rawArea;
        item.roundedAreaPerItem = areaCalc.roundedArea;
        item.chargeableAreaPerItem = areaCalc.chargeableArea;
        
        // Calculate total chargeable area
        const chargeablePerItem = parseFloat(areaCalc.chargeableArea.toString());
        const totalChargeable = chargeablePerItem * item.quantity;
        item.totalChargeableArea = mongoose.Types.Decimal128.fromString(totalChargeable.toFixed(4));
        
        // Calculate item subtotal
        const pricePerUnit = parseFloat(item.pricePerAreaUnit.toString());
        const subtotal = totalChargeable * pricePerUnit;
        item.itemSubtotal = mongoose.Types.Decimal128.fromString(subtotal.toFixed(2));
        
        return item;
    }
    
    /**
     * Create client snapshot from client data
     * @param {Object} client - Client document
     * @returns {Object} - Client snapshot
     */
    static createClientSnapshot(client) {
        return {
            clientName: client.clientName,
            contactPerson: client.contactPerson,
            contactNumber: client.contactNumber,
            email: client.email,
            billingAddress: client.billingAddress,
            siteAddress: client.siteAddress,
            gstin: client.gstin
        };
    }
    
    /**
     * Get company settings for quotation defaults
     * @param {string} companyId - Company ID
     * @returns {Promise<Object>} - Settings object
     */
    static async getCompanySettings(companyId) {
        const settings = await Setting.findOne({ companyId });
        return settings || {
            units: {
                dimension: 'inches',
                area: 'sqft'
            },
            termsAndConditions: {
                quotation: ''
            },
            paymentTerms: {
                quotation: '100% Advance payment required before commencement of work. Payment can be made via bank transfer, UPI, or cash.'
            },
            gst: {
                enabled: false,
                percentage: 0
            }
        };
    }
    
    /**
     * Validate quotation status transition
     * @param {string} currentStatus - Current status
     * @param {string} newStatus - New status to transition to
     * @returns {boolean} - Whether transition is allowed
     */
    static validateStatusTransition(currentStatus, newStatus) {
        const allowedTransitions = {
            'Draft': ['Sent', 'Expired'],
            'Sent': ['Viewed', 'Expired'],
            'Viewed': ['Accepted', 'Rejected', 'Expired'],
            'Accepted': ['Converted'],
            'Rejected': [],
            'Expired': [],
            'Converted': []
        };
        
        return allowedTransitions[currentStatus]?.includes(newStatus) || false;
    }
    
    /**
     * Calculate GST and other charges
     * @param {number} subtotal - Subtotal amount
     * @param {Object} gstSettings - GST settings
     * @param {Array} customCharges - Custom charges array
     * @returns {Object} - Calculated charges
     */
    static calculateCharges(subtotal, gstSettings, customCharges = []) {
        const charges = [...customCharges];
        
        // Add GST if enabled
        if (gstSettings.enabled && gstSettings.percentage > 0) {
            const gstAmount = (subtotal * gstSettings.percentage) / 100;
            charges.push({
                description: `GST (${gstSettings.percentage}%)`,
                amount: mongoose.Types.Decimal128.fromString(gstAmount.toFixed(2)),
                isTax: true,
                isPredefined: true
            });
        }
        
        return charges;
    }
    
    /**
     * Get material snapshots for quotation items
     * @param {string} productTypeId - Product type ID
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} quantity - Quantity
     * @returns {Promise<Array>} - Material snapshots
     */
    static async getMaterialSnapshots(productTypeId, width, height, quantity) {
        try {
            const productType = await ProductType.findById(productTypeId);
            if (!productType) return [];
            
            const snapshots = [];
            
            for (const material of productType.materials) {
                for (const formulaStr of material.formulas) {
                    try {
                        // Simple formula evaluation (replace with proper math parser if needed)
                        const formula = formulaStr.replace(/W/g, width).replace(/H/g, height);
                        const result = eval(formula); // Note: Use mathjs in production for security
                        
                        snapshots.push({
                            materialId: material.materialId,
                            materialName: material.materialNameSnapshot,
                            quantity: mongoose.Types.Decimal128.fromString((result * quantity).toFixed(4)),
                            unit: material.quantityUnit
                        });
                    } catch (error) {
                        console.warn(`Formula evaluation error for ${formulaStr}:`, error);
                    }
                }
            }
            
            return snapshots;
        } catch (error) {
            console.error('Error getting material snapshots:', error);
            return [];
        }
    }
}

module.exports = QuotationService; 