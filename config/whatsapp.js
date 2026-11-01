const crypto = require('crypto');

const DEFAULT_PRODUCT_MAP = {
  '112': 1,
  '113': 2,
  '114': 3,
  '115': 4,
  '116': 5,
  '117': 6,
  '118': 7,
};

const parseProductMap = (raw) => {
  if (!raw) return { ...DEFAULT_PRODUCT_MAP };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
      return parsed;
    }
    return { ...DEFAULT_PRODUCT_MAP };
  } catch (err) {
    return { ...DEFAULT_PRODUCT_MAP };
  }
};

const getWhatsAppConfig = () => ({
  enabled: process.env.WHATSAPP_INBOX_ENABLED === 'true',
  phoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
  token: process.env.WHATSAPP_TOKEN || '',
  appSecret: process.env.WHATSAPP_APP_SECRET || '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  version: (process.env.WHATSAPP_GRAPH_VERSION || 'v21.0').trim(),
  catalogId: process.env.WHATSAPP_CATALOG_ID || '',
  productMap: parseProductMap(process.env.WHATSAPP_CATALOG_PRODUCT_MAP),
});

const verifySignature = (rawBody, signature, secret) => {
  if (!secret || !Buffer.isBuffer(rawBody) || !/^sha256=[a-f0-9]{64}$/i.test(signature || '')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
};

const missingSettings = config => [
  ['WHATSAPP_INBOX_ENABLED', config.enabled],
  ['WHATSAPP_PHONE_NUMBER_ID', /^\d+$/.test(config.phoneNumberId)],
  ['WHATSAPP_TOKEN', config.token],
  ['WHATSAPP_APP_SECRET', config.appSecret],
  ['WHATSAPP_VERIFY_TOKEN', config.verifyToken],
].filter(([, value]) => !value).map(([key]) => key);

module.exports = { getWhatsAppConfig, verifySignature, missingSettings, parseProductMap, DEFAULT_PRODUCT_MAP };
