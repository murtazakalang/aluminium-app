const mongoose = require('mongoose');
require('dotenv').config();

// Database Optimization Script for Aluminium App
// This script adds additional indexes and optimizes the database for better performance

async function optimizeDatabase() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        
        console.log('📊 Starting database optimization...');

        // 1. Add compound indexes for frequently queried collections
        console.log('🔍 Adding performance indexes...');

        // User queries optimization
        await db.collection('users').createIndex({ 
            companyId: 1, 
            role: 1, 
            isActive: 1 
        });

        // Client search optimization
        await db.collection('clients').createIndex({ 
            companyId: 1, 
            clientName: "text", 
            email: "text", 
            contactNumber: "text" 
        });

        // Order status and date queries
        await db.collection('orders').createIndex({ 
            companyId: 1, 
            status: 1, 
            createdAt: -1 
        });

        await db.collection('orders').createIndex({ 
            companyId: 1, 
            clientId: 1, 
            status: 1 
        });

        // Quotation performance indexes
        await db.collection('quotations').createIndex({ 
            companyId: 1, 
            status: 1, 
            validUntil: 1 
        });

        // Invoice queries optimization
        await db.collection('invoices').createIndex({ 
            companyId: 1, 
            status: 1, 
            createdAt: -1 
        });

        await db.collection('invoices').createIndex({ 
            companyId: 1, 
            clientId: 1, 
            status: 1 
        });

        // Material inventory optimization
        await db.collection('materialv2s').createIndex({ 
            companyId: 1, 
            category: 1, 
            'profileBatches.currentLength': 1 
        });

        await db.collection('materialv2s').createIndex({ 
            companyId: 1, 
            name: "text", 
            category: "text" 
        });

        // Product type searches
        await db.collection('producttypes').createIndex({ 
            companyId: 1, 
            isActive: 1, 
            name: "text" 
        });

        console.log('✅ Performance indexes added');

        // 2. Set up collection-level optimizations
        console.log('⚙️ Applying collection optimizations...');

        // Enable read concern for consistency
        const collections = ['users', 'clients', 'orders', 'quotations', 'invoices', 'materialv2s', 'producttypes'];
        
        for (const collectionName of collections) {
            try {
                await db.collection(collectionName).createIndex({ companyId: 1 });
                console.log(`✓ Optimized ${collectionName} collection`);
            } catch (error) {
                console.log(`⚠️ Index may already exist for ${collectionName}: ${error.message}`);
            }
        }

        // 3. Database statistics and recommendations
        console.log('📈 Gathering database statistics...');
        
        const stats = await db.stats();
        console.log(`
📊 Database Statistics:
   Collections: ${stats.collections}
   Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB
   Index Size: ${(stats.indexSize / 1024 / 1024).toFixed(2)} MB
   Storage Size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB
        `);

        // 4. Check for slow operations
        console.log('🐌 Checking for slow operations...');
        
        try {
            const profilerStatus = await db.command({ profile: -1 });
            console.log('Profiler Status:', profilerStatus);
            
            if (profilerStatus.was === 0) {
                await db.command({ profile: 1, slowms: 100 });
                console.log('✅ Enabled slow operation profiling (>100ms)');
            }
        } catch (error) {
            console.log('⚠️ Could not enable profiling:', error.message);
        }

        // 5. Generate optimization report
        console.log('📋 Generating optimization report...');
        
        const indexStats = {};
        for (const collectionName of collections) {
            try {
                const indexInfo = await db.collection(collectionName).indexInformation();
                indexStats[collectionName] = Object.keys(indexInfo).length;
            } catch (error) {
                indexStats[collectionName] = 'Error getting stats';
            }
        }

        console.log('\n📊 Index Summary by Collection:');
        Object.entries(indexStats).forEach(([collection, count]) => {
            console.log(`   ${collection}: ${count} indexes`);
        });

        console.log('\n🎯 Optimization Recommendations:');
        console.log('   1. Monitor slow queries using: db.system.profile.find().sort({ts: -1}).limit(5)');
        console.log('   2. Run explain() on frequent queries to verify index usage');
        console.log('   3. Consider archiving old data (>1 year) to separate collections');
        console.log('   4. Enable MongoDB compression at rest for storage savings');
        console.log('   5. Set up connection pooling with max 10-15 connections for your server');

        console.log('\n✅ Database optimization completed successfully!');

    } catch (error) {
        console.error('❌ Database optimization failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔐 Database connection closed');
    }
}

// Configuration recommendations for MongoDB
const mongoConfigRecommendations = {
    wiredTiger: {
        cacheSizeGB: 1.5, // For 8GB system
        journalCompressor: 'snappy',
        collectionBlockCompressor: 'snappy',
        indexPrefixCompression: true
    },
    operationProfiling: {
        slowOpThresholdMs: 100,
        mode: 'slowOp'
    },
    connections: {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000
    }
};

console.log('🚀 Starting Aluminium App Database Optimization...');
console.log('📝 Recommended MongoDB Configuration:');
console.log(JSON.stringify(mongoConfigRecommendations, null, 2));
console.log('\n');

optimizeDatabase().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
}); 