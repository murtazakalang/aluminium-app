const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for migration');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// ProductType schema (simplified for migration)
const productTypeSchema = new mongoose.Schema({
    companyId: mongoose.Schema.Types.ObjectId,
    name: String,
    defaultLabourCost: mongoose.Schema.Types.Decimal128,
    labourCost: {
        type: {
            type: String,
            enum: ['fixed', 'perSqft', 'perSqm', 'percentage'],
            default: 'fixed'
        },
        value: {
            type: mongoose.Schema.Types.Decimal128,
            default: '0.00'
        }
    }
}, { timestamps: true });

const ProductType = mongoose.model('ProductType', productTypeSchema);

const migrateLaborCosts = async () => {
    try {
        console.log('Starting labour cost migration...');
        
        // Find all ProductTypes with old defaultLabourCost field
        const productTypes = await ProductType.find({
            defaultLabourCost: { $exists: true },
            labourCost: { $exists: false }
        });
        
        console.log(`Found ${productTypes.length} ProductTypes to migrate`);
        
        let migrated = 0;
        let skipped = 0;
        
        for (const productType of productTypes) {
            try {
                // Get the old labour cost value
                const oldLabourCost = productType.defaultLabourCost 
                    ? parseFloat(productType.defaultLabourCost.toString()) 
                    : 0;
                
                // Set the new labour cost structure
                productType.labourCost = {
                    type: 'fixed', // Default to fixed type
                    value: mongoose.Types.Decimal128.fromString(oldLabourCost.toFixed(2))
                };
                
                // Remove the old field
                productType.defaultLabourCost = undefined;
                
                // Save the document
                await productType.save();
                
                console.log(`✅ Migrated ${productType.name} (${productType._id}): ${oldLabourCost} -> fixed: ${oldLabourCost}`);
                migrated++;
                
            } catch (error) {
                console.error(`❌ Error migrating ProductType ${productType._id}:`, error);
                skipped++;
            }
        }
        
        console.log(`\n🎉 Migration completed!`);
        console.log(`✅ Successfully migrated: ${migrated}`);
        console.log(`❌ Skipped due to errors: ${skipped}`);
        
    } catch (error) {
        console.error('Migration error:', error);
    }
};

const main = async () => {
    await connectDB();
    await migrateLaborCosts();
    await mongoose.connection.close();
    console.log('Migration script completed and database connection closed.');
};

// Run the migration
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { migrateLaborCosts }; 