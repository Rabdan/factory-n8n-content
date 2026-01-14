const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    try {
        console.log('Starting migration...');

        // Add dates column
        await pool.query(`
            ALTER TABLE content_plans 
            ADD COLUMN IF NOT EXISTS dates JSONB DEFAULT '[]'::jsonb;
        `);

        // Get all existing content plans with start_date and end_date
        const result = await pool.query('SELECT * FROM content_plans WHERE start_date IS NOT NULL AND end_date IS NOT NULL');
        
        console.log(`Found ${result.rows.length} plans to migrate`);
        
        for (const plan of result.rows) {
            const startDate = new Date(plan.start_date);
            const endDate = new Date(plan.end_date);
            const dates = [];
            
            // Generate array of dates between start and end
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                dates.push(currentDate.toISOString().split('T')[0]);
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            // Update the plan with dates array
            await pool.query(
                'UPDATE content_plans SET dates = $1 WHERE id = $2',
                [JSON.stringify(dates), plan.id]
            );
            
            console.log(`Migrated plan ${plan.id}: ${plan.name || 'unnamed'} - ${dates.length} dates`);
        }
        
        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
