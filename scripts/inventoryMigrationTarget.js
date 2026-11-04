require('dotenv').config();
const { Sequelize } = require('sequelize');

function inventoryMigrationTarget(args, allowedFlags) {
  const values = {};
  for (const arg of args) {
    const match = /^--(target|database)=([^=]+)$/.exec(arg);
    if (match && values[match[1]] === undefined) {
      values[match[1]] = match[2];
    } else if (!allowedFlags.includes(arg)) {
      throw new Error(`Unexpected option: ${arg}`);
    }
  }

  const { target, database } = values;
  if (!['test', 'production'].includes(target) || !database) {
    throw new Error('Specify --target=test|production and --database=<exact schema name>');
  }

  const envKey = target === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  if (!process.env[envKey]) throw new Error(`${envKey} is required for the selected target`);
  const url = new URL(process.env[envKey]);
  const actualDatabase = decodeURIComponent(url.pathname.slice(1));
  if (url.protocol !== 'mysql:' || actualDatabase !== database ||
      (target === 'test') !== (database === 'loulou_test')) {
    throw new Error(`Database name does not match the selected target in ${envKey}`);
  }

  const ssl = url.searchParams.get('ssl') === 'true' ||
    url.hostname.endsWith('.tidbcloud.com') || process.env.DB_SSL === 'true';
  url.search = '';
  return new Sequelize(url.toString(), {
    logging: false,
    dialectOptions: ssl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {},
  });
}

module.exports = { inventoryMigrationTarget };
