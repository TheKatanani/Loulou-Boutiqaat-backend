process.env.NODE_ENV = 'test';
require('dotenv').config();
// This suite never falls back to DATABASE_URL and never truncates shared tables.
if (!process.env.TEST_DATABASE_URL || new URL(process.env.TEST_DATABASE_URL).pathname !== '/loulou_test') {
  throw new Error('Inbox integration tests require TEST_DATABASE_URL targeting loulou_test');
}
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../../models');
const orderService = require('../../services/orderService');
const { createWhatsAppInbox } = require('../../services/whatsappInboxService');
const { createRouter } = require('../../router/api/whatsappInbox');
const { createInboxWebhook } = require('../../middleware/whatsappInboxWebhook');

test('WhatsApp inbox against isolated MySQL, with a fake Meta transport', { timeout: 240000 }, async t => {
  await db.initPromise;
  assert.equal(db.isConnected, true, 'Test database must actually be connected');
  assert.equal(db.sequelize.config.database, 'loulou_test');
  const prefix = crypto.randomUUID();
  const config = { enabled: true, phoneNumberId: '111' + Date.now(), token: 'fake-test-token',
    appSecret: 'fake-test-app-secret', verifyToken: 'fake-test-verify', version: 'v21.0', catalogId: 'test-catalog', productMap: {} };
  let clock = new Date();
  let behavior = 'success';
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (behavior === 'timeout') throw new Error('simulated lost provider response');
    if (behavior === 'rejected') return new Response(JSON.stringify({ error: { message: 'Rejected by fake provider', code: 123 } }), { status: 400 });
    if (url.endsWith('/media') && options.method === 'POST') return new Response(JSON.stringify({ id: 'fake-media-id' }), { status: 200 });
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.out.' + prefix + '.' + calls.length }] }), { status: 200 });
  };
  const inbox = createWhatsAppInbox({ db, orderService, getConfig: () => config, fetchImpl: fakeFetch, now: () => clock });
  const incoming = (id, type = 'text', extra = {}) => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
    metadata: { phone_number_id: config.phoneNumberId, display_phone_number: '15550000000' },
    contacts: [{ wa_id: '15550001001', profile: { name: 'Inbox acceptance fixture' } }],
    messages: [{ id: 'wamid.in.' + prefix + '.' + id, from: '15550001001', timestamp: String(Math.floor(clock.getTime() / 1000)),
      type, ...(type === 'text' ? { text: { body: 'مرحبا، هل المنتج متوفر؟' } } : {}), ...extra }],
  } }] }] });
  let conversation, product, category, server, baseUrl, nativeOrder;
  const ids = [];
  try {
    await t.test('normal inbound messages persist, and webhook retries do not duplicate them', async () => {
      const payload = incoming('hello');
      await inbox.ingestWebhook(payload); await inbox.ingestWebhook(payload);
      const rows = await inbox.list(); assert.equal(rows.length, 1);
      conversation = rows[0]; assert.equal(conversation.unreadCount, 1); assert.equal(conversation.canReply, true);
      const history = await inbox.history(conversation.id);
      assert.equal(history.messages.length, 1); assert.equal(history.messages[0].text, 'مرحبا، هل المنتج متوفر؟');
      assert.equal('payload' in history.messages[0], false);
    });
    await t.test('manual send is durable and deduplicated after a lost client response', async () => {
      const args = { text: 'أهلاً، المنتج متوفر', clientRequestId: 'manual:' + prefix, sentByUserId: 1 };
      const before = calls.length;
      const sent = await inbox.send(conversation.id, args);
      const replay = await inbox.send(conversation.id, args);
      assert.equal(sent.id, replay.id); assert.equal(calls.length, before + 1); assert.equal(sent.status, 'sent');
      const c = await inbox.getConversation(conversation.id); assert.equal(c.automationPaused, true);
      await assert.rejects(inbox.send(conversation.id, { ...args, text: 'different payload' }), error => error.statusCode === 409);
      ids.push(sent.id);
    });
    await t.test('delivery statuses never downgrade read to delivered / sent', async () => {
      const sent = await db.whatsappMessage.findByPk(ids[0]);
      const event = status => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
        metadata: { phone_number_id: config.phoneNumberId }, statuses: [{ id: sent.metaMessageId, status }],
      } }] }] });
      await inbox.ingestWebhook(event('read')); await inbox.ingestWebhook(event('delivered'));
      assert.equal((await sent.reload()).status, 'read');
    });
    await t.test('ambiguous Meta timeout is not resent by repeating the request', async () => {
      behavior = 'timeout'; const before = calls.length;
      const args = { text: 'timeout fixture', clientRequestId: 'unknown:' + prefix, sentByUserId: 1 };
      const message = await inbox.send(conversation.id, args); assert.equal(message.status, 'unknown');
      assert.equal((await inbox.send(conversation.id, args)).id, message.id);
      assert.equal(calls.length, before + 1); behavior = 'success';
    });
    await t.test('24-hour window is enforced on the server', async () => {
      clock = new Date(clock.getTime() + 86400001);
      await assert.rejects(inbox.send(conversation.id, { text: 'late', clientRequestId: 'late:' + prefix, sentByUserId: 1 }), error => error.statusCode === 409);
      await inbox.ingestWebhook(incoming('reopened'));
      assert.equal((await inbox.history(conversation.id)).conversation.canReply, true);
    });
    await t.test('mark-read does not acknowledge messages arriving after the viewed message', async () => {
      const history = await inbox.history(conversation.id); const through = history.messages[history.messages.length - 1].id;
      await inbox.ingestWebhook(incoming('unseen')); await inbox.markRead(conversation.id, through);
      assert.equal((await inbox.getConversation(conversation.id)).unreadCount, 1);
      await inbox.markRead(conversation.id, through);
      assert.equal((await inbox.getConversation(conversation.id)).unreadCount, 1);
    });
    await t.test('switching Phone Number ID hides messages from the other channel', async () => {
      const old = config.phoneNumberId; config.phoneNumberId = old + '9';
      assert.deepEqual(await inbox.list(), []);
      await assert.rejects(inbox.history(conversation.id), error => error.statusCode === 404);
      config.phoneNumberId = old;
    });
    await t.test('catalog order replay after interrupted processing does not deduct stock again', async () => {
      category = await db.category.create({ name: 'inbox-test-' + prefix, published: false });
      product = await db.products.create({ name: 'inbox-test-' + prefix, price: 17, stock: 5, published: true, categoryId: category.id });
      config.productMap = { fixtureSku: product.id };
      const payload = incoming('catalog', 'order', { order: { catalog_id: config.catalogId, product_items: [{ product_retailer_id: 'fixtureSku', quantity: 1 }] } });
      await inbox.ingestWebhook(payload); await inbox.processPending();
      const key = 'wa-native:' + crypto.createHash('sha256').update('wamid.in.' + prefix + '.catalog').digest('hex');
      nativeOrder = await db.order.findOne({ where: { idempotencyKey: key } });
      assert.ok(nativeOrder); assert.equal((await product.reload()).stock, 4);
      const message = await db.whatsappMessage.findOne({ where: { metaMessageId: 'wamid.in.' + prefix + '.catalog' } });
      assert.equal(message.automationState, 'done');
      await message.update({ automationState: 'pending' });
      await inbox.ingestWebhook(payload); await inbox.processPending();
      assert.equal(await db.order.count({ where: { idempotencyKey: key } }), 1);
      assert.equal((await product.reload()).stock, 4);
      await orderService.cancelOrExpireOrder(nativeOrder.id, 'cancelled');
      assert.equal((await product.reload()).stock, 5);
    });
    await t.test('catalog order with excessive quantity notifies customer and marks automation failed with 3 attempts', async () => {
      await (await inbox.getConversation(conversation.id)).update({ automationPaused: false });
      const payload = incoming('catalog-excess', 'order', { order: { catalog_id: config.catalogId, product_items: [{ product_retailer_id: 'fixtureSku', quantity: 999 }] } });
      const beforeCalls = calls.length;
      await inbox.ingestWebhook(payload);
      await inbox.processPending();
      const message = await db.whatsappMessage.findOne({ where: { metaMessageId: 'wamid.in.' + prefix + '.catalog-excess' } });
      assert.equal(message.automationState, 'failed');
      assert.equal(message.automationAttempts, 3);
      assert.ok(message.error.includes('غير متوفر'));
      assert.equal(calls.length, beforeCalls + 1);
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall.options.body);
      assert.ok(body.text.body.includes('عذراً، تعذر إتمام الطلب'));
      await inbox.processPending();
      assert.equal(calls.length, beforeCalls + 1);
    });
    await t.test('staff routes deny guests and customers; signed webhook rejects tampering', async () => {
      const app = express();
      app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
      app.use('/whatsapp', createRouter(inbox, () => config));
      app.post('/webhook', createInboxWebhook(inbox, () => config));
      server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
      baseUrl = 'http://127.0.0.1:' + server.address().port;
      assert.equal((await fetch(baseUrl + '/whatsapp/config')).status, 401);
      const token = role => jwt.sign({ userInfo: { id: 1, name: 'Fixture', roles: role } }, process.env.ACCESS_TOKEN_SECRET || 'loulou_access_token_secret_default_key_2026');
      assert.equal((await fetch(baseUrl + '/whatsapp/config', { headers: { Authorization: 'Bearer ' + token(2001) } })).status, 401);
      const response = await fetch(baseUrl + '/whatsapp/config', { headers: { Authorization: 'Bearer ' + token(5150) } });
      assert.equal(response.status, 200); const data = await response.json();
      assert.equal('token' in data, false); assert.equal('appSecret' in data, false);
      const bytes = JSON.stringify(incoming('signed'));
      const signature = 'sha256=' + crypto.createHmac('sha256', config.appSecret).update(bytes).digest('hex');
      assert.equal((await fetch(baseUrl + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature }, body: bytes })).status, 200);
      assert.equal((await fetch(baseUrl + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature }, body: bytes + ' ' })).status, 403);
    });
    await t.test('media upload uses server-side token and records a single message', async () => {
      const args = { text: '', clientRequestId: 'file:' + prefix, sentByUserId: 1,
        attachment: { bytes: Buffer.from('%PDF-1.7 fixture'), mimeType: 'application/pdf', filename: 'fixture.pdf', type: 'document' } };
      const sent = await inbox.send(conversation.id, args); assert.equal(sent.status, 'sent'); assert.equal(sent.mediaId, 'fake-media-id');
      const before = calls.length; await inbox.send(conversation.id, args); assert.equal(calls.length, before);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    // Only this run's channel and catalog fixtures are removed. Existing test data remains intact.
    const convs = await db.whatsappConversation.findAll({ where: { phoneNumberId: config.phoneNumberId }, attributes: ['id'] });
    const convIds = convs.map(x => x.id);
    if (convIds.length) await db.whatsappMessage.destroy({ where: { conversationId: { [Op.in]: convIds } } });
    await db.whatsappConversation.destroy({ where: { phoneNumberId: config.phoneNumberId } });
    if (nativeOrder) await db.order.destroy({ where: { id: nativeOrder.id } });
    if (product) await product.destroy();
    if (category) await category.destroy();
    await db.sequelize.close();
  }
});
