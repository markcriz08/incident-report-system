const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.warn("⚠️ Warning: DATABASE_URL not found in environment variables.");
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;