const crypto = require('crypto');
const { Op } = require('sequelize');
const { getWhatsAppConfig, missingSettings } = require('../config/whatsapp');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const WINDOW_MS = 24 * 60 * 60 * 1000;
const rank = { failed: -1, unknown: 0, sending: 0, sent: 1, delivered: 2, read: 3, received: 1 };
const json = row => row?.get ? row.get({ plain: true }) : row;
const preview = msg => (msg.text?.body || msg[msg.type]?.caption || {
  image: 'صورة', audio: 'رسالة صوتية', video: 'فيديو', document: 'ملف',
  order: 'طلب من الكتالوج', location: 'موقع', sticker: 'ملصق',
  contacts: 'جهة اتصال', interactive: 'رد تفاعلي',
}[msg.type] || 'رسالة').slice(0, 250);
const canReply = (conversation, now = new Date()) => Boolean(conversation.lastIncomingAt &&
  now.getTime() - new Date(conversation.lastIncomingAt).getTime() < WINDOW_MS);

// Dependencies are injectable so tests cannot accidentally send to Meta or touch the production DB.
const createWhatsAppInbox = ({ db, orderService, getConfig = getWhatsAppConfig,
  fetchImpl, now = () => new Date() }) => {
  const transport = fetchImpl || ((...args) => fetch(...args));
  const Conversation = db.whatsappConversation;
  const Message = db.whatsappMessage;
  let working = false;

  const ready = () => {
    const config = getConfig();
    const missing = missingSettings(config);
    if (missing.length) throw fail('إعدادات محادثات واتساب غير مكتملة: ' + missing.join(', '), 503);
    if (!db.isConnected) throw fail('قاعدة البيانات غير متصلة', 503);
    if (!/^v\d+\.\d+$/.test(config.version)) throw fail('إصدار Graph API غير صالح', 503);
    return config;
  };
  const channelWhere = () => ({ phoneNumberId: getConfig().phoneNumberId });
  const getConversation = async id => {
    const row = await Conversation.findOne({ where: { id, ...channelWhere() } });
    if (!row) throw fail('المحادثة غير موجودة على الرقم الحالي', 404);
    return row;
  };
  const publicConversation = row => ({ ...json(row), canReply: canReply(row, now()),
    replyWindowExpiresAt: row.lastIncomingAt ? new Date(new Date(row.lastIncomingAt).getTime() + WINDOW_MS) : null });
  const graph = async (path, options = {}) => {
    const c = ready();
    if (process.env.NODE_ENV === 'test' && !fetchImpl) throw fail('الإرسال الحقيقي إلى Meta معطل في بيئة الاختبار', 503);
    let response;
    try {
      response = await transport(`https://graph.facebook.com/${c.version}/${path}`, {
        ...options, headers: { Authorization: `Bearer ${c.token}`, ...options.headers },
        signal: AbortSignal.timeout(20000), redirect: 'error',
      });
    } catch (error) { throw Object.assign(fail('تعذر تأكيد الاستجابة من واتساب. راجع حالة الرسالة قبل تكرار الإرسال.', 502), { uncertain: true }); }
    const data = await response.json();
    if (!response.ok) throw Object.assign(fail(data.error?.message || 'رفض واتساب الطلب', 502), {
      uncertain: response.status >= 500, providerCode: data.error?.code,
    });
    return data;
  };

  const recordIncoming = async (msg, value) => {
    if (!msg.id || !/^\d{6,20}$/.test(msg.from || '')) return null;
    const c = getConfig();
    const timestamp = Number(msg.timestamp) * 1000;
    const occurredAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(Math.min(timestamp, now().getTime())) : now();
    const [base] = await Conversation.findOrCreate({
      where: { phoneNumberId: c.phoneNumberId, customerPhone: msg.from },
      defaults: { customerName: value.contacts?.find(x => x.wa_id === msg.from)?.profile?.name?.slice(0, 160) || msg.from,
        displayPhoneNumber: value.metadata?.display_phone_number },
    });
    return db.sequelize.transaction(async transaction => {
      const conversation = await Conversation.findByPk(base.id, { transaction, lock: transaction.LOCK.UPDATE });
      const existing = await Message.findOne({ where: { metaMessageId: msg.id }, transaction });
      if (existing) return existing;
      const media = msg[msg.type] || {};
      const message = await Message.create({ conversationId: conversation.id, metaMessageId: msg.id,
        direction: 'inbound', type: msg.type || 'unknown', text: msg.text?.body || media.caption || preview(msg),
        mediaId: media.id || null, mimeType: media.mime_type || null, filename: media.filename?.slice(0, 255),
        payload: msg, status: 'received', occurredAt, automationState: 'pending',
      }, { transaction });
      const patch = { unreadCount: conversation.unreadCount + 1 };
      if (!conversation.lastIncomingAt || occurredAt > conversation.lastIncomingAt) patch.lastIncomingAt = occurredAt;
      if (!conversation.lastMessageAt || occurredAt >= conversation.lastMessageAt) {
        patch.lastMessageAt = occurredAt; patch.lastMessagePreview = preview(msg);
      }
      const name = value.contacts?.find(x => x.wa_id === msg.from)?.profile?.name;
      if (name) patch.customerName = name.slice(0, 160);
      await conversation.update(patch, { transaction });
      return message;
    });
  };

  const recordStatus = async status => {
    if (!status.id || !(status.status in rank)) return;
    await db.sequelize.transaction(async transaction => {
      const where = status.biz_opaque_callback_data && /^\d+$/.test(status.biz_opaque_callback_data)
        ? { [Op.or]: [{ metaMessageId: status.id }, { id: Number(status.biz_opaque_callback_data) }] }
        : { metaMessageId: status.id };
      const message = await Message.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
      if (!message || message.direction !== 'outbound') return;
      const conversation = await Conversation.findOne({ where: { id: message.conversationId, ...channelWhere() }, transaction });
      if (!conversation) return;
      if (status.status === 'failed' && rank[message.status] < 2) {
        await message.update({ status: 'failed', metaMessageId: status.id,
          error: status.errors?.[0]?.title || 'تعذر تسليم الرسالة' }, { transaction });
      } else if (rank[status.status] > rank[message.status]) {
        await message.update({ status: status.status, metaMessageId: status.id, error: null }, { transaction });
      }
    });
  };

  const ingestWebhook = async body => {
    ready();
    if (body.object !== 'whatsapp_business_account') throw fail('Webhook object غير صالح');
    for (const entry of body.entry || []) for (const change of entry.changes || []) {
      const value = change.value;
      if (value?.metadata?.phone_number_id !== getConfig().phoneNumberId) continue;
      for (const status of value.statuses || []) await recordStatus(status);
      for (const message of value.messages || []) await recordIncoming(message, value);
    }
  };

  const send = async (conversationId, { text = '', clientRequestId, sentByUserId = null, attachment = null }) => {
    const config = ready();
    if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(clientRequestId || '')) throw fail('مفتاح محاولة الإرسال مطلوب');
    const conversation = await getConversation(conversationId);
    text = String(text).trim();
    if ((!text && !attachment) || text.length > (attachment ? 1024 : 4096)) throw fail('نص الرسالة فارغ أو أطول من المسموح');
    const hash = attachment ? crypto.createHash('sha256').update(attachment.bytes).digest('hex') : null;
    const content = { text, fileHash: hash };
    // A response lost after Meta accepted the send must never trigger a second send.
    const existing = await Message.findOne({ where: { clientRequestId } });
    if (existing) {
      if (existing.conversationId !== conversation.id || existing.payload?.text !== content.text || existing.payload?.fileHash !== content.fileHash) {
        throw fail('مفتاح الإرسال مستخدم لرسالة أخرى', 409);
      }
      return existing;
    }
    if (!canReply(conversation, now())) throw fail('انتهت نافذة الرد العادي (24 ساعة). يلزم أن يراسلك العميل مجدداً أو إرسال قالب معتمد.', 409);
    if (!sentByUserId && conversation.automationPaused) return null;
    let message;
    try {
      message = await Message.create({ conversationId: conversation.id, clientRequestId, payload: content,
        direction: 'outbound', type: attachment ? attachment.type : 'text', text, sentByUserId,
        filename: attachment?.filename, mimeType: attachment?.mimeType,
        status: 'sending', occurredAt: now(), automationState: 'done' });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return send(conversationId, { text, clientRequestId, sentByUserId, attachment });
      }
      throw error;
    }
    if (sentByUserId) await conversation.update({ automationPaused: true });
    try {
      let mediaId;
      if (attachment) {
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('file', new Blob([attachment.bytes], { type: attachment.mimeType }), attachment.filename);
        mediaId = (await graph(`${config.phoneNumberId}/media`, { method: 'POST', body: form })).id;
        if (!mediaId) throw fail('لم يستلم الخادم معرف الملف من واتساب', 502);
        await message.update({ mediaId });
      }
      const payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to: conversation.customerPhone,
        type: message.type, biz_opaque_callback_data: String(message.id) };
      if (attachment) payload[message.type] = { id: mediaId, ...(text ? { caption: text } : {}),
        ...(message.type === 'document' ? { filename: attachment.filename } : {}) };
      else payload.text = { body: text };
      const result = await graph(`${config.phoneNumberId}/messages`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const metaMessageId = result.messages?.[0]?.id;
      if (!metaMessageId) throw Object.assign(fail('لم يصل تأكيد الإرسال من واتساب', 502), { uncertain: true });
      await db.sequelize.transaction(async transaction => {
        const current = await Message.findByPk(message.id, { transaction, lock: transaction.LOCK.UPDATE });
        await current.update({ metaMessageId, status: rank[current.status] > 1 ? current.status : 'sent', error: null }, { transaction });
      });
      await conversation.update({ lastMessageAt: now(), lastMessagePreview: (text || attachment?.filename || 'ملف').slice(0, 250) });
    } catch (error) {
      // No automatic retry on timeouts / 5xx: Meta may already have accepted the message.
      const current = await Message.findByPk(message.id);
      if (rank[current.status] < 1) await current.update({ status: error.uncertain ? 'unknown' : 'failed', error: error.message });
    }
    return Message.findByPk(message.id);
  };

  const processOrder = async message => {
    const msg = message.payload;
    const conversation = await getConversation(message.conversationId);
    let reply = '';
    let businessError = null;
    if (msg.type === 'order') {
      const c = getConfig();
      if (c.catalogId && msg.order?.catalog_id !== c.catalogId) throw fail('الطلب من كتالوج غير متصل بالرقم الحالي');
      const items = (msg.order?.product_items || []).map(item => {
        const rawId = item.product_retailer_id;
        const mappedId = c.productMap && c.productMap[rawId] != null
          ? c.productMap[rawId]
          : (Number(rawId) >= 112 && Number(rawId) <= 118 ? Number(rawId) - 111 : rawId);
        return {
          productId: Number(mappedId),
          quantity: Number(item.quantity),
        };
      });
      if (!items.length || items.some(x => !Number.isSafeInteger(x.productId) || !Number.isSafeInteger(x.quantity) || x.quantity < 1)) {
        throw fail('معرفات منتجات الكتالوج أو الكميات غير صالحة');
      }
      try {
        const draft = await orderService.createWhatsAppDraft({ items, customerPhone: conversation.customerPhone,
          customerName: conversation.customerName, location: 'طلب مباشر من كتالوج واتساب',
          idempotencyKey: 'wa-native:' + crypto.createHash('sha256').update(message.metaMessageId).digest('hex') });
        reply = `أهلاً بكِ! 🌸 تم استلام طلبكِ وحجز المنتجات برقم ${draft.orderCode} بإجمالي ${draft.totalCost} ₪. الطلب قيد مراجعة الإدارة لتأكيد التوصيل.`;
      } catch (err) {
        businessError = err;
        reply = `عذراً، تعذر إتمام الطلب: ${err.message}`;
      }
    } else if (msg.type === 'text') {
      const code = msg.text?.body?.match(/#?LB-\d+/i)?.[0]?.toUpperCase();
      if (!code) return;
      const order = await db.order.findOne({ where: { orderCode: code.startsWith('#') ? code : '#' + code } });
      // A public order code alone does not authorize linking another customer's conversation.
      if (!order || (order.customerPhone && order.customerPhone.replace(/\D/g, '') !== conversation.customerPhone)) return;
      if (order.orderStatus === 'cancelled') reply = `الطلب ${order.orderCode} ملغى. يمكننا مساعدتك بطلب جديد.`;
      else if (order.orderStatus === 'expired' || (order.expiresAt && new Date(order.expiresAt) <= now())) {
        reply = `انتهت مهلة حجز ${order.orderCode}. يمكنكِ إعادة اختيار المنتجات من المتجر.`;
      } else reply = `أهلاً بكِ! 🌸 وصلت رسالتكِ بخصوص الطلب ${order.orderCode}. سيتابع فريق المتجر معكِ لتأكيد التوصيل.`;
    }
    if (reply) {
      const result = await send(conversation.id, { text: reply,
        clientRequestId: (businessError ? 'auto-err:' : 'auto:') + crypto.createHash('sha256').update(message.metaMessageId).digest('hex') });
      if (result?.status === 'failed') throw fail(result.error);
    }
    if (businessError) {
      throw Object.assign(businessError, { isBusiness: true });
    }
  };

  const processPending = async () => {
    if (working || !getConfig().enabled || !db.isConnected || missingSettings(getConfig()).length) return;
    working = true;
    try {
      const stale = new Date(now().getTime() - 2 * 60 * 1000);
      const messages = await Message.findAll({ where: { direction: 'inbound', automationAttempts: { [Op.lt]: 3 },
        [Op.or]: [{ automationState: 'pending' }, { automationState: 'failed', automationLockedAt: { [Op.lt]: stale } },
          { automationState: 'processing', automationLockedAt: { [Op.lt]: stale } }] }, order: [['id', 'ASC']], limit: 20 });
      for (const message of messages) {
        const conversation = await Conversation.findOne({ where: { id: message.conversationId, ...channelWhere() } });
        if (!conversation) continue;
        const [claimed] = await Message.update({ automationState: 'processing', automationLockedAt: now(),
          automationAttempts: message.automationAttempts + 1 }, { where: { id: message.id,
          automationState: message.automationState, automationAttempts: message.automationAttempts } });
        if (!claimed) continue;
        try { await processOrder(message); await message.update({ automationState: 'done' }); }
        catch (error) {
          const isBusiness = Boolean(error.isBusiness || (error.statusCode && error.statusCode < 500) || /غير متوفر|غير موجود|غير صالحة|ملغى/i.test(error.message));
          await message.update({
            automationState: 'failed',
            automationAttempts: isBusiness ? 3 : message.automationAttempts + 1,
            error: error.message
          });
        }
      }
    } finally { working = false; }
  };

  const list = async ({ search = '', before } = {}) => {
    ready();
    const where = { ...channelWhere(), ...(before ? { id: { [Op.lt]: before } } : {}) };
    if (search.trim()) where[Op.or] = ['customerPhone', 'customerName'].map(key => ({ [key]: { [Op.like]: `%${search.trim().slice(0, 100)}%` } }));
    const rows = await Conversation.findAll({ where, order: [['lastMessageAt', 'DESC'], ['id', 'DESC']], limit: 100 });
    return rows.map(publicConversation);
  };
  const history = async (id, { before, after } = {}) => {
    ready(); const conversation = await getConversation(id);
    const where = { conversationId: conversation.id };
    if (before) where.id = { [Op.lt]: before };
    if (after) where.id = { [Op.gt]: after };
    let rows = await Message.findAll({ where, order: [['id', after ? 'ASC' : 'DESC']], limit: 51 });
    const hasMore = rows.length > 50; rows = rows.slice(0, 50);
    if (!after) rows.reverse();
    const updates = await Message.findAll({ where: { conversationId: conversation.id, direction: 'outbound' },
      attributes: ['id', 'status', 'error', 'metaMessageId'], order: [['id', 'DESC']], limit: 50 });
    return { conversation: publicConversation(conversation), updates, messages: rows.map(row => {
      const { payload, ...safe } = json(row); return safe;
    }), hasMore };
  };
  const markRead = async (id, throughId) => {
    const base = await getConversation(id);
    await db.sequelize.transaction(async transaction => {
      const conversation = await Conversation.findByPk(base.id, { transaction, lock: transaction.LOCK.UPDATE });
      const through = await Message.findOne({ where: { id: throughId, conversationId: base.id }, transaction });
      if (!through) return;
      const lastReadMessageId = Math.max(conversation.lastReadMessageId, through.id);
      const unreadCount = await Message.count({ where: { conversationId: base.id, direction: 'inbound', id: { [Op.gt]: lastReadMessageId } }, transaction });
      await conversation.update({ lastReadMessageId, unreadCount }, { transaction });
    });
  };
  const download = async id => {
    ready(); const message = await Message.findByPk(id);
    if (!message?.mediaId) throw fail('الملف غير موجود', 404);
    await getConversation(message.conversationId);
    const info = await graph(`${encodeURIComponent(message.mediaId)}?phone_number_id=${getConfig().phoneNumberId}`);
    const url = new URL(info.url);
    if (url.protocol !== 'https:' || !['fbsbx.com', 'fbcdn.net', 'facebook.com', 'whatsapp.net'].some(host => url.hostname === host || url.hostname.endsWith('.' + host))) throw fail('عنوان ملف واتساب غير صالح', 502);
    if (Number(info.file_size) > 16 * 1024 * 1024) throw fail('الملف أكبر من 16 ميغابايت', 413);
    const response = await transport(url.href, { headers: { Authorization: `Bearer ${getConfig().token}` }, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw fail('تعذر تنزيل الملف من واتساب', 502);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 16 * 1024 * 1024) throw fail('الملف أكبر من 16 ميغابايت', 413);
      chunks.push(Buffer.from(chunk));
    }
    return { bytes: Buffer.concat(chunks), mimeType: info.mime_type || message.mimeType || 'application/octet-stream', filename: message.filename || `whatsapp-${message.id}` };
  };
  return { ready, ingestWebhook, processPending, list, history, markRead, send, download, getConversation, publicConversation };
};

module.exports = { createWhatsAppInbox, canReply, preview, fail };
