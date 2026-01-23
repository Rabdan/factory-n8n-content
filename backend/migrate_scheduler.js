#!/usr/bin/env node

const db = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    try {
        console.log('Applying migrations for automatic post publication system...');
        
        const migrationPath = path.join(__dirname, 'db', 'migrations', 'add_post_scheduler.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await db.query(migrationSQL);
        
        console.log('✅ Migrations applied successfully');
        console.log('Added fields:');
        console.log('- publish_attempts: number of publication attempts');
        console.log('- updated_at: last update time');
        console.log('- Indexes for faster post search');
        
    } catch (error) {
        console.error('❌ Error applying migrations:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };