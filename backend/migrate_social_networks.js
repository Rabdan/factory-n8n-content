const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrateSocialNetworks() {
    try {
        console.log('Starting migration of social_networks...');

        // Remove default_publish_days column
        await pool.query(`
            ALTER TABLE social_networks 
            DROP COLUMN IF EXISTS default_publish_days;
        `);

        console.log('Removed default_publish_days column from social_networks');

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    migrateSocialNetworks();
}

module.exports = { migrateSocialNetworks };