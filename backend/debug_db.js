const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' }); // Adjust if needed

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/contentfactory'
});

async function check() {
    try {
        const res = await pool.query('SELECT name, logo_url FROM social_networks');
        console.log('Social Networks:', res.rows);
        const res2 = await pool.query('SELECT id, media_files FROM posts WHERE media_files IS NOT NULL LIMIT 5');
        console.log('Posts Media:', res2.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
check();
