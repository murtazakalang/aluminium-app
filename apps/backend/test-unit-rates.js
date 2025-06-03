const mongoose = require('mongoose');

async function testUnitRates() {
    try {
        await mongoose.connect('mongodb://localhost:27017/aluminium_app');
        console.log('Connected to MongoDB');
        
        const Material = mongoose.model('Material', new mongoose.Schema({}, { strict: false }));
        
        // Find the test material
        const material = await Material.findOne({ name: '3Track Top' });
        
        if (material) {
            console.log('\n=== Material Found ===');
            console.log('Name:', material.name);
            console.log('Category:', material.category);
            console.log('\n=== Stock By Length ===');
            
            if (material.stockByLength && material.stockByLength.length > 0) {
                material.stockByLength.forEach((stock, index) => {
                    console.log(`Stock Entry ${index + 1}:`);
                    console.log(`  Length: ${stock.length} ${stock.unit}`);
                    console.log(`  Gauge: ${stock.gauge || 'Not set'}`);
                    console.log(`  Quantity: ${stock.quantity}`);
                    console.log(`  Unit Rate: ${stock.unitRate || 'Not set'}`);
                    console.log(`  Low Stock Threshold: ${stock.lowStockThreshold}`);
                    console.log('---');
                });
            } else {
                console.log('No stock entries found');
            }
            
            console.log('\n=== Gauge Specific Weights ===');
            if (material.gaugeSpecificWeights && material.gaugeSpecificWeights.length > 0) {
                material.gaugeSpecificWeights.forEach((gauge, index) => {
                    console.log(`Gauge ${index + 1}: ${gauge.gauge} - ${gauge.weightPerUnitLength} ${material.weightUnit}/${gauge.unitLength}`);
                });
            } else {
                console.log('No gauge weights found');
            }
            
        } else {
            console.log('Material "3Track Top" not found in database');
            
            // List all materials
            const allMaterials = await Material.find({}, { name: 1, category: 1 });
            console.log('\nAvailable materials:');
            allMaterials.forEach(mat => {
                console.log(`- ${mat.name} (${mat.category})`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

testUnitRates(); 