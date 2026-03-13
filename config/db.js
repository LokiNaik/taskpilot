const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

pool.connect()
  .then(() => require('./logger').info('Database connected ✓'))
  .catch(err => {
    require('./logger').error(`Database connection failed: ${err.message}`);
    require('./logger').error('Make sure PostgreSQL is running and .env is configured correctly');
  });

module.exports = pool;
