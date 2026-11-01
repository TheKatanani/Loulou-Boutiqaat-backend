const express = require('express');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const roles = require('../../config/roles_list');
const { getWhatsAppConfig, missingSettings } = require('../../config/whatsapp');
const { fail } = require('../../services/whatsappInboxService');

const serialize = row => {
  const { payload, ...data } = row.get ? row.get({ plain: true }) : row;
  return data;
};
const attachmentFrom = req => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw fail('الملف فارغ');
  const mimeType = (req.get('Content-Type') || '').split(';')[0];
  const bytes = req.body;
  const jpeg = mimeType === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = mimeType === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const pdf = mimeType === 'application/pdf' && bytes.subarray(0, 5).toString() === '%PDF-';
  if (!jpeg && !png && !pdf) throw fail('الملفات المدعومة: صور JPEG وPNG وملفات PDF فقط');
  let filename;
  try { filename = decodeURIComponent(req.get('X-Filename') || 'attachment'); } catch { throw fail('اسم الملف غير صالح'); }
  filename = filename.replace(/[\r\n\\/\x00-\x1f]/g, '_').slice(0, 200);
  return { bytes, mimeType, filename, type: pdf ? 'document' : 'image' };
};

const createRouter = (inbox, getConfig = getWhatsAppConfig) => {
  const router = express.Router();
  router.use(verifyJWT, verifyRoles(roles.ADMIN, roles.EDITOR));
  const action = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (error) { res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'تعذر تنفيذ طلب المحادثات، يرجى إعادة المحاولة' }); }
  };
  router.get('/config', action(async (req, res) => {
    const c = getConfig();
    res.json({ enabled: c.enabled, phoneNumberId: c.phoneNumberId, catalogId: c.catalogId,
      ready: missingSettings(c).length === 0, missing: missingSettings(c) });
  }));
  router.get('/conversations', action(async (req, res) => res.json(await inbox.list({ search: String(req.query.search || '') }))));
  router.get('/conversations/:id/messages', action(async (req, res) => {
    const options = {};
    for (const key of ['before', 'after']) if (req.query[key]) {
      const value = Number(req.query[key]);
      if (!Number.isSafeInteger(value) || value < 1) throw fail('مؤشر الرسائل غير صالح');
      options[key] = value;
    }
    res.json(await inbox.history(req.params.id, options));
  }));
  router.post('/conversations/:id/read', action(async (req, res) => {
    inbox.ready();
    const throughId = Number(req.body.throughId);
    if (!Number.isSafeInteger(throughId) || throughId < 1) throw fail('معرف الرسالة غير صالح');
    await inbox.markRead(req.params.id, throughId); res.sendStatus(204);
  }));
  router.patch('/conversations/:id', action(async (req, res) => {
    inbox.ready();
    if (typeof req.body.automationPaused !== 'boolean') throw fail('قيمة إيقاف الردود الآلية غير صالحة');
    const c = await inbox.getConversation(req.params.id);
    await c.update({ automationPaused: req.body.automationPaused });
    res.json(inbox.publicConversation(c));
  }));
  router.post('/conversations/:id/messages', action(async (req, res) => {
    if (typeof req.body.text !== 'string') throw fail('نص الرسالة مطلوب');
    const message = await inbox.send(req.params.id, { text: req.body.text,
      clientRequestId: req.body.clientRequestId, sentByUserId: req.id });
    res.status(201).json(serialize(message));
  }));
  router.post('/conversations/:id/attachments', express.raw({ type: () => true, limit: '5mb' }), action(async (req, res) => {
    const message = await inbox.send(req.params.id, { attachment: attachmentFrom(req),
      clientRequestId: req.get('X-Client-Request-Id'), sentByUserId: req.id });
    res.status(201).json(serialize(message));
  }));
  router.get('/messages/:id/media', action(async (req, res) => {
    const media = await inbox.download(req.params.id);
    res.set({ 'Content-Type': media.mimeType, 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(media.filename)}` });
    res.send(media.bytes);
  }));
  router.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'الحد الأقصى للملف 5 ميغابايت' });
    next(error);
  });
  return router;
};
module.exports = { createRouter, attachmentFrom };
