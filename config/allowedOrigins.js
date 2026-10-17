require('dotenv').config();

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/$/, ''))
  : [];

const frontendUrl = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL.trim().replace(/\/$/, '')]
  : [];

const defaultOrigins = [
  'https://127.0.0.1:3000',
  'https://127.0.0.1:3001',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3500',
  'https://localhost:3500',
  'https://thekatanani.com',
  'https://www.thekatanani.com'
];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins, ...frontendUrl])).filter(Boolean);

module.exports = allowedOrigins;