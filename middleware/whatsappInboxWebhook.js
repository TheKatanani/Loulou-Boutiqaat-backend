const { getWhatsAppConfig, verifySignature } = require('../config/whatsapp');

const createInboxWebhook = (inbox, getConfig = getWhatsAppConfig) => async (req, res, next) => {
  const config = getConfig();
  if (!config.enabled) return next();
  if (!config.appSecret) return res.status(503).json({ message: 'WHATSAPP_APP_SECRET is required for the inbox' });
  if (!verifySignature(req.rawBody, req.get('X-Hub-Signature-256'), config.appSecret)) return res.sendStatus(403);
  try {
    await inbox.ingestWebhook(req.body);
    res.status(200).send('EVENT_RECEIVED');
    // Persist first. The periodic worker also recovers work interrupted after this acknowledgement.
    setImmediate(() => inbox.processPending().catch(error => console.error('WhatsApp processing:', error.message)));
  } catch (error) {
    res.status(error.statusCode || 503).json({ message: 'Webhook could not be persisted; retry delivery' });
  }
};

module.exports = { createInboxWebhook };
