const mongoose = require('mongoose');
const MaterialV2 = require('../models/MaterialV2'); // Assuming MaterialV2 model is in ../models
const Decimal = require('decimal.js');
const { convertUnit } = require('./unitConverter'); // Assuming unitConverter is in the same directory or path is adjusted

/**
 * Calculates the weight of a material cut.
 * 
 * @param {object} material - The material object from the database.
 * @param {string} gauge - The gauge of the material (e.g., "18G").
 * @param {number|string} cutLength - The length of the cut.
 * @param {string} cutLengthUnit - The unit of the cutLength (e.g., 'inches', 'mm', 'ft').
 * @returns {object} An object containing the calculatedWeight and weightUnit, or an error string.
 * 
 * Assumptions:
 * - MaterialV2 schema has `gaugeSpecificWeights` array: [{ gauge, weightPerUnitLength, unitLength }]
 * - MaterialV2 schema has `weightUnit` (e.g., 'kg', 'lbs') - this is the target unit for the output.
 * - `weightPerUnitLength` is in `material.weightUnit` per `unitLength` (e.g., kg/ft).
 */
const getWeight = (material, gauge, cutLength, cutLengthUnit) => {
    if (!material || !material.gaugeSpecificWeights || !material.weightUnit) {
        return { error: 'Invalid material data provided for weight calculation.' };
    }

    const gaugeInfo = material.gaugeSpecificWeights.find(gw => gw.gauge === gauge);
    if (!gaugeInfo) {
        return { error: `Weight information for gauge '${gauge}' not found in material '${material.name}'.` };
    }

    const { weightPerUnitLength, unitLength } = gaugeInfo;
    const materialWeightUnit = material.weightUnit;

    if (!weightPerUnitLength || !unitLength) {
        return { error: `Incomplete weight/length data for gauge '${gauge}' in material '${material.name}'.` };
    }

    let cutLengthInFt;
    const numericCutLength = parseFloat(cutLength.toString());

    // Convert cutLength to feet (assuming unitLength in gaugeSpecificWeights is 'ft')
    // TODO: Make this more robust if unitLength can vary from 'ft'
    if (unitLength.toLowerCase() !== 'ft') {
        return { error: `Gauge specific weight unitLength '${unitLength}' is not 'ft'. Complex conversion needed.` };
    }

    switch (cutLengthUnit.toLowerCase()) {
        case 'inches':
        case 'inch':
            cutLengthInFt = numericCutLength / 12;
            break;
        case 'mm':
            cutLengthInFt = numericCutLength / 304.8; // 1 ft = 304.8 mm
            break;
        case 'cm':
            cutLengthInFt = numericCutLength / 30.48; // 1 ft = 30.48 cm
            break;
        case 'm':
            cutLengthInFt = numericCutLength / 0.3048; // 1 ft = 0.3048 m
            break;
        case 'ft':
        case 'feet':
            cutLengthInFt = numericCutLength;
            break;
        default:
            return { error: `Unsupported cutLengthUnit: '${cutLengthUnit}'.` };
    }

    try {
        const weightPerUnitLength_D = new Decimal(weightPerUnitLength.toString());
        const cutLengthInFt_D = new Decimal(cutLengthInFt.toString());
        const calculatedWeight_D = weightPerUnitLength_D.times(cutLengthInFt_D);

        // Assuming weightPerUnitLength is already in the final material.weightUnit (e.g. 0.24 kg/ft)
        // If weightPerUnitLength was in a different unit than material.weightUnit, further conversion would be needed here.

        return {
            calculatedWeight: calculatedWeight_D.toString(), // Convert back to string for Decimal128 compatibility if needed downstream
            weightUnit: materialWeightUnit
        };
    } catch (e) {
        console.error(`[getWeight] Error during Decimal.js calculation for material '${material.name}', gauge '${gauge}':`, e);
        return { error: `Calculation error for weight: ${e.message}` };
    }
};

/**
 * Converts a given length of a material to its equivalent weight based on gauge-specific data.
 *
 * @param {number} length The length of the material.
 * @param {string} lengthUnit The unit of the input length (e.g., 'ft', 'inches').
 * @param {object} material The inventory material object, containing gaugeSpecificWeights and weightUnit.
 * @param {string} gauge The specific gauge of the profile material to use for weight calculation.
 * @returns {{weight: number | null, weightUnit: string | null, error: string | null}}
 */
function convertProfileLengthToWeight(length, lengthUnit, material, gauge) {
    if (typeof length !== 'number' || isNaN(length) || length <= 0) {
        return { weight: null, weightUnit: null, error: 'Invalid input length. Must be a positive number.' };
    }
    if (!material || !material.gaugeSpecificWeights || !Array.isArray(material.gaugeSpecificWeights) || !material.weightUnit) {
        return { weight: null, weightUnit: null, error: 'Invalid material data. Missing gaugeSpecificWeights or weightUnit.' };
    }
    if (!gauge) {
        return { weight: null, weightUnit: null, error: 'Gauge must be specified for profile weight calculation.' };
    }

    const gaugeInfo = material.gaugeSpecificWeights.find(gw => gw.gauge === gauge);
    if (!gaugeInfo) {
        return { weight: null, weightUnit: null, error: `Weight information for gauge '${gauge}' not found in material '${material.name}'.` };
    }

    const { weightPerUnitLength, unitLength: gswUnitLength } = gaugeInfo; // e.g., 0.5 kg/ft

    if (!weightPerUnitLength || !gswUnitLength) {
        return { weight: null, weightUnit: null, error: `Incomplete weight/length data for gauge '${gauge}' in material '${material.name}'. Missing weightPerUnitLength or unitLength.` };
    }

    try {
        const weightPerUnitLength_Decimal = new Decimal(weightPerUnitLength.toString());

        // Convert the input length to the unit system of gaugeInfo.unitLength (e.g., if input is inches, convert to ft if gswUnitLength is ft)
        const conversionResult = convertUnit(length, lengthUnit, gswUnitLength);
        if (conversionResult.error) {
            return { weight: null, weightUnit: null, error: `Error converting input length unit: ${conversionResult.error}` };
        }
        const lengthInGswUnit = new Decimal(conversionResult.result);

        const calculatedWeight_Decimal = lengthInGswUnit.times(weightPerUnitLength_Decimal);
        
        return {
            weight: parseFloat(calculatedWeight_Decimal.toFixed(5)), // Return as number, potentially with rounding
            weightUnit: material.weightUnit,
            error: null
        };

    } catch (err) {
        console.error("Error in convertProfileLengthToWeight: ", err);
        return { weight: null, weightUnit: null, error: 'Calculation error during length to weight conversion.' };
    }
}

module.exports = {
    getWeight,
    convertProfileLengthToWeight
}; 