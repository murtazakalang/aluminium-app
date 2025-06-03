const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const ProductType = require('../models/ProductType');

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aluminiumDB';

async function backupProductTypes() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully.');

        // Get all ProductTypes
        console.log('\nFetching all ProductTypes...');
        const productTypes = await ProductType.find({}).lean();
        
        console.log(`Found ${productTypes.length} ProductTypes to backup.`);

        // Create backup directory if it doesn't exist
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Create backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `productTypes_backup_${timestamp}.json`);

        // Write backup file
        console.log(`\nWriting backup to: ${backupFile}`);
        fs.writeFileSync(backupFile, JSON.stringify(productTypes, null, 2));

        console.log('✅ Backup completed successfully!');
        console.log(`Backup location: ${backupFile}`);
        console.log(`Total ProductTypes backed up: ${productTypes.length}`);

        return backupFile;

    } catch (error) {
        console.error('Error during backup:', error);
        throw error;
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('\nMongoDB connection closed.');
    }
}

// Run the script
if (require.main === module) {
    console.log('Starting ProductType Backup Script...');
    console.log('='.repeat(50));
    backupProductTypes()
        .then((backupFile) => {
            console.log(`\n✅ Backup completed: ${backupFile}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Backup failed:', error);
            process.exit(1);
        });
}

module.exports = { backupProductTypes }; 