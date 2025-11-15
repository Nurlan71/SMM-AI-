const { Pool } = require('pg');

// The pool will use the following environment variables by default:
// PGUSER: process.env.PGUSER
// PGHOST: process.env.PGHOST
// PGDATABASE: process.env.PGDATABASE
// PGPASSWORD: process.env.PGPASSWORD
// PGPORT: process.env.PGPORT

const pool = new Pool({
  // You can add connection options here if needed,
  // but it's best to use environment variables.
  // For example, for SSL:
  // ssl: {
  //   rejectUnauthorized: false
  // }
});

pool.on('connect', () => {
    console.log('🔗 Successfully connected to PostgreSQL database.');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};