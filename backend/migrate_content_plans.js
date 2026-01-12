const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    try {
        console.log('Starting migration...');

        // Add new columns to content_plans
        await pool.query(`
            ALTER TABLE content_plans 
            ADD COLUMN IF NOT EXISTS name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS platforms JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3b82f6',
            ADD COLUMN IF NOT EXISTS is_generated BOOLEAN DEFAULT FALSE;
        `);

        // Check columns of content_plans to verify
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'content_plans';
        `);
        console.log('Content Plans columns:', res.rows);

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
