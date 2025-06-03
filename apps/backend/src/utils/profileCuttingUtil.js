const { convertUnit } = require('./unitConverter'); // Assuming unitConverter is in the same directory or adjust path

const CUTTING_LOSS_INCHES = 0.125; // Kerf loss per cut after the first piece on a pipe
const SCRAP_THRESHOLD_FEET = 3.0;
const SCRAP_THRESHOLD_INCHES = SCRAP_THRESHOLD_FEET * 12.0;
const EPSILON_INCHES = 0.001; // For floating point comparisons

/**
 * Custom error class for profile cutting issues.
 */
class ProfileCuttingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProfileCuttingError';
        this.statusCode = 400;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Converts a length value (potentially a Decimal128 object) to a float.
 * @param {string|number|object} lengthInput - The length input.
 * @param {string|number|object} originalInputForError - The original input for error reporting.
 * @returns {number} - The float representation of the length.
 * @throws {ProfileCuttingError} - If the length cannot be parsed.
 */
function parseFloatLength(lengthInput, originalInputForError) {
    let numLength;
    if (lengthInput !== null && typeof lengthInput === 'object') {
        if (lengthInput.$numberDecimal !== undefined) {
            numLength = parseFloat(lengthInput.$numberDecimal);
        } else if (typeof lengthInput.toString === 'function' && lengthInput.toString() !== '[object Object]') {
            numLength = parseFloat(lengthInput.toString());
        } else {
            throw new ProfileCuttingError(`Invalid object lengthInput type: ${JSON.stringify(originalInputForError || lengthInput)}`);
        }
    } else if (typeof lengthInput === 'string' || typeof lengthInput === 'number') {
        numLength = parseFloat(lengthInput.toString());
    } else {
        throw new ProfileCuttingError(`Invalid lengthInput type (neither object, string, nor number): ${JSON.stringify(originalInputForError || lengthInput)}`);
    }

    if (isNaN(numLength)) {
        throw new ProfileCuttingError(`Cannot parse length to float from: ${JSON.stringify(originalInputForError || lengthInput)} (processed as ${lengthInput.toString()})`);
    }
    return numLength;
}

/**
 * Implements the cutting logic based on the Google Apps Script provided.
 * Optimizes pipe usage by selecting the pipe that offers the best immediate fit (least scrap)
 * for a greedy packing of the currently remaining cuts.
 *
 * @param {object} materialObject - The full material object, including standardLengths array.
 * @param {string} companyId - The ID of the company (as string).
 * @param {number[]} requiredCutLengths_ft - An array of required cut lengths in feet.
 * @returns {Promise<object>} - {
 *   totalPipesFromStock: number,
 *   pipesTakenPerStandardLength: Array<{ length: string, unit: string, count: number }>,
 *   totalScrapGenerated_ft: number,
 *   finalUsableOffcuts_ft: number[]
 * }
 * @throws {ProfileCuttingError} - If material issues, or a cut is too large for any available stock.
 */
async function calculateProfileConsumption(materialObject, companyId, requiredCutLengths_ft) {
    const material = materialObject;

    // Basic Validations
    if (!material || !material._id) throw new ProfileCuttingError('Invalid Material object provided.');
    if (material.companyId.toString() !== companyId.toString()) throw new ProfileCuttingError('Material not associated with this company.');
    if (material.category !== 'Profile') throw new ProfileCuttingError('This function is only for Profile materials.');
    if (!material.standardLengths || material.standardLengths.length === 0) throw new ProfileCuttingError('Material has no defined standard lengths.');

    // 1. Convert standard lengths to INCHES and prepare them
    const standardLengths_in = material.standardLengths.map((sl, index) => {
        try {
            const numLength = parseFloatLength(sl.length, sl);
            const conversion = convertUnit(numLength, sl.unit, 'inches');
            if (conversion.error || conversion.result === null || isNaN(conversion.result) || conversion.result <= EPSILON_INCHES) {
                throw new ProfileCuttingError(`Invalid standard length ${JSON.stringify(sl)} (parsed as ${numLength}): ${conversion.error || 'conversion failed'}.`);
            }
            
            let numericStringLength;
            if (sl.length !== null && typeof sl.length === 'object' && sl.length.$numberDecimal !== undefined) {
                numericStringLength = sl.length.$numberDecimal;
            } else if (sl.length !== null && typeof sl.length.toString === 'function') {
                numericStringLength = sl.length.toString();
                if (numericStringLength === '[object Object]') {
                     console.warn(`[WARN] ProfileCuttingUtil: toString() for standard length resulted in [object Object] for: ${JSON.stringify(sl)}`);
                     if(sl.length && sl.length.$numberDecimal) numericStringLength = sl.length.$numberDecimal.toString(); // Check sl.length exists before $numberDecimal
                     else throw new ProfileCuttingError(`Standard length ${JSON.stringify(sl.length)} resulted in [object Object] and has no $numberDecimal`);
                }
            } else {
                numericStringLength = String(sl.length); // Fallback
            }

            return {
                originalLengthStr: numericStringLength,
                originalUnit: sl.unit,
                lengthInInches: conversion.result,
                id: `${numericStringLength}_${sl.unit}_${index}` // Unique ID for tracking
            };
        } catch (e) {
            if (e instanceof ProfileCuttingError) throw e;
            throw new ProfileCuttingError(`Error processing standard length ${JSON.stringify(sl)}: ${e.message}`);
        }
    }).sort((a, b) => b.lengthInInches - a.lengthInInches); // Sort largest standard pipes first (helps with some packing, though Apps Script iterates all)

    if (standardLengths_in.length === 0) throw new ProfileCuttingError('No valid standard lengths after conversion to inches.');

    // 2. Convert required cuts to INCHES and sort them (largest first - FFD style for initial order)
    let cutsToPlace_in = requiredCutLengths_ft.map((cut_ft, index) => {
        if (typeof cut_ft !== 'number' || isNaN(cut_ft) || cut_ft <= 0) {
            throw new ProfileCuttingError(`Invalid required cut value in feet at index ${index}: ${cut_ft}`);
        }
        const conversion = convertUnit(cut_ft, 'ft', 'inches');
        if (conversion.error || conversion.result === null || isNaN(conversion.result) || conversion.result <= EPSILON_INCHES) {
            throw new ProfileCuttingError(`Failed to convert cut ${cut_ft}ft to inches: ${conversion.error || 'conversion failed'}.`);
        }
        return conversion.result;
    }).sort((a, b) => b - a);

    // Initial validation: can largest cut fit into largest pipe?
    if (cutsToPlace_in.length > 0 && standardLengths_in.length > 0 && cutsToPlace_in[0] > standardLengths_in[0].lengthInInches + EPSILON_INCHES) {
        const cutFtDisplay = (cutsToPlace_in[0]/12).toFixed(2);
        const stockFtDisplay = (standardLengths_in[0].lengthInInches/12).toFixed(2);
        throw new ProfileCuttingError(`Largest cut ${cutsToPlace_in[0].toFixed(2)}in (${cutFtDisplay}ft) is greater than the largest available standard pipe ${standardLengths_in[0].lengthInInches.toFixed(2)}in (${stockFtDisplay}ft).`);
    }
    
    const usedPipeLayouts = []; // Stores details of each pipe chosen: { standardPipe, cutsPacked_in, lengthUsedWithLoss_in, immediateScrap_in }
    let unfulfillableScrapTotal_in = 0; // For cuts that cannot be placed on any pipe as per Apps Script logic

    // 3. Core Cutting Logic (emulating Apps Script)
    while (cutsToPlace_in.length > 0) {
        let bestPipeChoiceForThisIteration = null; // Stores { standardPipe, cutsPacked_in, lengthUsedWithLoss_in, immediateScrap_in }

        // Iterate through all available standard pipe sizes to find the best one for the current set of cuts
        for (const candidateStdPipe of standardLengths_in) {
            let currentCutsOnCandidate_in = [];
            let currentLengthUsedOnCandidate_in = 0;
            let piecesOnCandidate = 0;

            // Simulate packing cuts from the *current* cutsToPlace_in list onto this candidateStdPipe
            // The Apps Script iterates through its `remainingLengths` (which is sorted) for this simulation.
            const cutsToAttemptPacking = [...cutsToPlace_in]; // Use a copy, respecting current order

            for (const cut_in of cutsToAttemptPacking) {
                const lossForThisCut = (piecesOnCandidate > 0) ? CUTTING_LOSS_INCHES : 0;
                if (currentLengthUsedOnCandidate_in + cut_in + lossForThisCut <= candidateStdPipe.lengthInInches + EPSILON_INCHES) {
                    currentLengthUsedOnCandidate_in += (cut_in + lossForThisCut);
                    currentCutsOnCandidate_in.push(cut_in); // Store the actual cut length
                    piecesOnCandidate++;
                }
            }

            // If any cuts were packed, evaluate this candidate
            if (currentCutsOnCandidate_in.length > 0) {
                const currentImmediateScrap_in = candidateStdPipe.lengthInInches - currentLengthUsedOnCandidate_in;
                if (bestPipeChoiceForThisIteration === null || currentImmediateScrap_in < bestPipeChoiceForThisIteration.immediateScrap_in) {
                    bestPipeChoiceForThisIteration = {
                        standardPipe: candidateStdPipe, // The chosen standard pipe object
                        cutsPacked_in: currentCutsOnCandidate_in, // Array of cuts (inches) packed onto it
                        lengthUsedWithLoss_in: currentLengthUsedOnCandidate_in,
                        immediateScrap_in: currentImmediateScrap_in
                    };
                }
            }
        }

        if (bestPipeChoiceForThisIteration) {
            // A pipe was chosen, record its use and remove packed cuts from the main list
            usedPipeLayouts.push(bestPipeChoiceForThisIteration);
            
            for (const packedCut_in of bestPipeChoiceForThisIteration.cutsPacked_in) {
                // Find and remove the first occurrence of this cut length
                const indexToRemove = cutsToPlace_in.findIndex(c => Math.abs(c - packedCut_in) < EPSILON_INCHES);
                if (indexToRemove > -1) {
                    cutsToPlace_in.splice(indexToRemove, 1);
                } else {
                    // This might happen if multiple cuts of the exact same length were packed than existed,
                    // or a float precision issue not caught by EPSILON. Should be rare.
                    console.warn(`[WARN] ProfileCuttingUtil: Attempted to remove packed cut ${packedCut_in}in but not found in remaining cutsToPlace_in. Current list: ${JSON.stringify(cutsToPlace_in)}`);
                }
            }
        } else if (cutsToPlace_in.length > 0) {
            // No standard pipe could be chosen to pack *any* of the remaining cuts.
            // Apps Script: takes the largest remaining cut (cutsToPlace_in[0]) and considers it full scrap.
            const largestRemainingCut_in = cutsToPlace_in.shift(); // Remove and get the largest
            unfulfillableScrapTotal_in += largestRemainingCut_in;
            console.warn(`[WARN] ProfileCuttingUtil: Unfulfillable cut ${largestRemainingCut_in.toFixed(2)}in became direct scrap as no pipe choice could accommodate it or other cuts.`);
        }
        // If cutsToPlace_in is empty, the loop terminates.
    }

    // 4. Aggregate results
    const pipesTakenCounts = {}; // Key: standardPipe.id, Value: { length, unit, count, lengthInInches }
    let totalGeneratedScrapFromRemainders_in = 0;
    let finalUsableOffcuts_in = [];

    for (const layout of usedPipeLayouts) {
        const pipeId = layout.standardPipe.id;
        if (!pipesTakenCounts[pipeId]) {
            pipesTakenCounts[pipeId] = {
                length: layout.standardPipe.originalLengthStr,
                unit: layout.standardPipe.originalUnit,
                lengthInInches: layout.standardPipe.lengthInInches,
                count: 0
            };
        }
        pipesTakenCounts[pipeId].count++;

        // Handle the immediate scrap from this specific pipe layout
        if (layout.immediateScrap_in >= SCRAP_THRESHOLD_INCHES - EPSILON_INCHES) {
            finalUsableOffcuts_in.push(layout.immediateScrap_in);
        } else if (layout.immediateScrap_in > EPSILON_INCHES) { // Small, unusable scrap
            totalGeneratedScrapFromRemainders_in += layout.immediateScrap_in;
        }
    }
    
    // Total scrap includes unfulfillable cuts and small scraps from pipe remainders
    const totalCombinedScrap_in = totalGeneratedScrapFromRemainders_in + unfulfillableScrapTotal_in;

    const pipesTakenPerStandardLength = Object.values(pipesTakenCounts);
    finalUsableOffcuts_in.sort((a, b) => a - b); // Sort smallest to largest, though order might not matter for display

    // 5. Convert final values to feet for reporting
    const conversionScrap = convertUnit(totalCombinedScrap_in, 'inches', 'ft');
    const totalScrapGenerated_ft = conversionScrap.error ? parseFloat((totalCombinedScrap_in / 12).toFixed(3)) : parseFloat(conversionScrap.result.toFixed(3));

    const finalUsableOffcuts_ft = finalUsableOffcuts_in.map(rem_in => {
        const conv = convertUnit(rem_in, 'inches', 'ft');
        return conv.error ? parseFloat((rem_in / 12).toFixed(3)) : parseFloat(conv.result.toFixed(3));
    }).filter(rem_ft => rem_ft * 12 >= EPSILON_INCHES); // Ensure it's still significant after conversion

    return {
        totalPipesFromStock: usedPipeLayouts.length, // Total physical pipes taken from stock
        pipesTakenPerStandardLength,
        totalScrapGenerated_ft,
        finalUsableOffcuts_ft
    };
}

module.exports = {
    calculateProfileConsumption,
    ProfileCuttingError,
    SCRAP_THRESHOLD_FT: SCRAP_THRESHOLD_FEET 
}; 