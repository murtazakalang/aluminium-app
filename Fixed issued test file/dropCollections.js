const mongoose = require('mongoose');

// MongoDB connection configuration - uses Docker service name
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/aluminiumDB';

const COLLECTIONS_TO_DROP = [
    'creditnotes',
    'paymentreminders',
    'recurringinvoices'
];

async function dropCollections() {
    try {
        console.log(`Connecting to MongoDB: ${MONGODB_URI}`);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully.\n');

        console.log('Starting collection dropping process...');
        console.log('WARNING: This action is irreversible and will permanently delete the specified collections and all their data.\n');

        const db = mongoose.connection.db;

        for (const collectionName of COLLECTIONS_TO_DROP) {
            try {
                console.log(`Attempting to drop collection '${collectionName}'...`);
                const result = await db.dropCollection(collectionName);
                if (result) {
                    console.log(`Successfully dropped collection '${collectionName}'.`);
                } else {
                    // This case might not be hit often as dropCollection usually errors if it fails significantly
                    console.log(`Collection '${collectionName}' may not have existed or was not dropped (result: ${result}).`);
                }
            } catch (error) {
                if (error.message.includes('ns not found')) {
                    console.log(`Collection '${collectionName}' not found, skipping (already dropped or never existed).`);
                } else {
                    console.error(`Error dropping collection '${collectionName}':`, error.message);
                }
            }
        }

        console.log('\n✅ Collection dropping process completed.');

    } catch (error) {
        console.error('❌ Error during collection dropping process:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
}

if (require.main === module) {
    console.log('== COLLECTION DROPPING SCRIPT ==');
    // In a real production script, you would add a confirmation prompt here.
    // E.g., prompt user to type the database name or 'yes' to confirm.
    dropCollections()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { dropCollections, COLLECTIONS_TO_DROP }; 