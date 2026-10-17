require('dotenv').config();

module.exports = {
  HOST: process.env.DB_HOST || 'localhost',
  USER: process.env.DB_USER || 'root',
  PASSWORD: process.env.DB_PASSWORD || '',
  DATABASE: process.env.DB_NAME || 'loulouboutiqaat',
  PORT: process.env.DB_PORT || 3306,
  DIALECT: process.env.DB_DIALECT || 'mysql',
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};