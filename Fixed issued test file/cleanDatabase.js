const mongoose = require('mongoose');

// MongoDB connection configuration - uses Docker service name
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/aluminiumDB';

const COLLECTIONS_TO_CLEAN = [
    'materials',
    'producttypes',
    'orders',
    'quotations',
    'estimations',
    'clients',
    'companies',
    'settings',
    'counters',
    'cuttingplans',
    'invoices',
    'stocktransactions',
    'users' // WARNING: This will delete all users!
];

async function cleanDatabase() {
    try {
        console.log(`Connecting to MongoDB: ${MONGODB_URI}`);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully.\n');

        console.log('Starting database cleaning process...');
        console.log('WARNING: This action is irreversible and will delete data from the specified collections.\n');

        for (const collectionName of COLLECTIONS_TO_CLEAN) {
            try {
                const collection = mongoose.connection.db.collection(collectionName);
                const count = await collection.countDocuments();
                if (count > 0) {
                    console.log(`Deleting ${count} documents from '${collectionName}'...`);
                    await collection.deleteMany({});
                    console.log(`Successfully cleaned '${collectionName}'.`);
                } else {
                    console.log(`Collection '${collectionName}' is already empty.`);
                }
            } catch (error) {
                if (error.message.includes('ns not found')) {
                    console.log(`Collection '${collectionName}' not found, skipping.`);
                } else {
                    console.error(`Error cleaning collection '${collectionName}':`, error);
                }
            }
        }

        console.log('\n✅ Database cleaning process completed.');

    } catch (error) {
        console.error('❌ Error during database cleaning:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
}

if (require.main === module) {
    // Add a small delay and a confirmation prompt in a real scenario
    // For now, running directly for simplicity in this environment
    console.log('== DATABASE CLEANING SCRIPT ==');
    cleanDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { cleanDatabase, COLLECTIONS_TO_CLEAN }; 