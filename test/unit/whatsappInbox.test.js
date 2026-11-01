const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifySignature, missingSettings, parseProductMap, DEFAULT_PRODUCT_MAP } = require('../../config/whatsapp');
const { canReply, preview } = require('../../services/whatsappInboxService');
const { attachmentFrom } = require('../../router/api/whatsappInbox');

test('Meta signature is checked against exact bytes and rejects missing / malformed signatures', () => {
  const bytes = Buffer.from('{"text":"hello"}');
  const secret = 'unit-test-secret';
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(bytes).digest('hex');
  assert.equal(verifySignature(bytes, signature, secret), true);
  assert.equal(verifySignature(Buffer.from('{ "text":"hello"}'), signature, secret), false);
  for (const invalid of [undefined, '', 'sha256=abc', 'sha256=' + 'g'.repeat(64)]) {
    assert.equal(verifySignature(bytes, invalid, secret), false);
  }
  assert.equal(verifySignature(bytes, signature, ''), false);
});

test('normal replies close exactly 24 hours after the last customer message', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  assert.equal(canReply({ lastIncomingAt: new Date(now - 86400000 + 1) }, now), true);
  assert.equal(canReply({ lastIncomingAt: new Date(now - 86400000) }, now), false);
  assert.equal(canReply({}, now), false);
});

test('readiness never exposes or substitutes credentials', () => {
  const missing = missingSettings({ enabled: false, phoneNumberId: 'wrong' });
  assert.ok(missing.includes('WHATSAPP_APP_SECRET'));
  assert.ok(missing.includes('WHATSAPP_PHONE_NUMBER_ID'));
  assert.ok(missing.includes('WHATSAPP_INBOX_ENABLED'));
});

test('media upload checks MIME and file magic, and sanitizes filenames', () => {
  const headers = { 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent('../invoice.pdf') };
  const req = { body: Buffer.from('%PDF-1.7'), get: key => headers[key] };
  assert.equal(attachmentFrom(req).type, 'document');
  assert.equal(attachmentFrom(req).filename.includes('/'), false);
  req.body = Buffer.from('<script>bad</script>');
  assert.throws(() => attachmentFrom(req), /JPEG/);
  headers['Content-Type'] = 'image/svg+xml';
  assert.throws(() => attachmentFrom(req), /JPEG/);
});

test('incoming previews include normal chat and catalog orders', () => {
  assert.equal(preview({ type: 'text', text: { body: 'مرحبا' } }), 'مرحبا');
  assert.equal(preview({ type: 'order' }), 'طلب من الكتالوج');
  assert.equal(preview({ type: 'image', image: { caption: 'صورة المنتج' } }), 'صورة المنتج');
});

test('parseProductMap provides fallback for retailer IDs 112..118 and safely handles bad input', () => {
  assert.deepEqual(parseProductMap(null), DEFAULT_PRODUCT_MAP);
  assert.deepEqual(parseProductMap(''), DEFAULT_PRODUCT_MAP);
  assert.deepEqual(parseProductMap('{}'), DEFAULT_PRODUCT_MAP);
  assert.deepEqual(parseProductMap('invalid json{'), DEFAULT_PRODUCT_MAP);
  assert.deepEqual(parseProductMap('{"SKU-1": 10}'), { 'SKU-1': 10 });
  assert.equal(DEFAULT_PRODUCT_MAP['112'], 1);
  assert.equal(DEFAULT_PRODUCT_MAP['118'], 7);
});
