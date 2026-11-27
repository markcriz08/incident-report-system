const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

async function initializeDatabase() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your_neon')) {
    throw new Error('DATABASE_URL is missing or still contains a placeholder.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Database schema initialized successfully.');
  } finally {
    await pool.end();
  }
}

initializeDatabase().catch(error => {
  console.error(error.message);
  process.exit(1);
});
