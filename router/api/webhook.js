const express = require('express');
const router = express.Router();
const db = require('../../models');
const orderService = require('../../services/orderService');

/**
 * 1. Webhook Verification Endpoint (GET)
 * Meta calls this when setting up or verifying the webhook in Developer Console.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'loulou_wa_verify_token_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[WhatsApp Webhook] Verification successful from Meta!');
    return res.status(200).send(challenge);
  } else {
    console.warn('[WhatsApp Webhook] Verification failed. Token mismatch or invalid mode.');
    return res.sendStatus(403);
  }
});

/**
 * Helper to send a text reply back via WhatsApp Cloud API
 */
const sendWhatsAppReply = async (to, text, incomingPhoneId) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = incomingPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || '1442570565605256';

  if (!token || !phoneId) {
    console.log('[WhatsApp Reply Skipped] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set.');
    return;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('[WhatsApp Reply Error]', data || res.statusText);
    } else {
      console.log(`[WhatsApp Reply Sent] Successfully messaged ${to}`);
    }
  } catch (err) {
    console.error('[WhatsApp Reply Error]', err.message);
  }
};

/**
 * 2. Incoming Messages & Events Endpoint (POST)
 * Handles customer replies holding web order code #LB-xxx & native catalog orders.
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        if (value.statuses) {
          for (const st of value.statuses) {
            console.log(`[WhatsApp Status Event] ID: ${st.id} -> ${st.status}`, st.errors || '');
          }
        }

        if (!value.messages) continue;
        const metadataPhoneId = value.metadata?.phone_number_id;

        for (const msg of value.messages) {
          const from = msg.from; // e.g. "970592263808"
          const msgType = msg.type;

          console.log(`[WhatsApp Incoming] Type: ${msgType} from: ${from}`);

          // A) Customer sends message with web draft order code (#LB-xxx)
          if (msgType === 'text') {
            const bodyText = msg.text?.body || '';
            const codeMatch = bodyText.match(/(?:#?LB-\d+)/i);

            if (codeMatch) {
              const rawCode = codeMatch[0].toUpperCase();
              const orderCode = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;

              console.log(`[WhatsApp Order Match] Detected orderCode: ${orderCode}`);

              if (db.isConnected) {
                const order = await db.order.findOne({
                  where: { orderCode },
                });

                if (order) {
                  const now = new Date();
                  const isExpired = order.expiresAt && new Date(order.expiresAt) <= now;

                  if (isExpired || order.orderStatus === 'expired') {
                    await sendWhatsAppReply(
                      from,
                      `عذراً، حجز الطلب ${orderCode} انتهت صلاحيته (تجاوزت الـ 60 دقيقة). يمكنكِ إعادة اختيار المنتجات من المتجر في أي وقت! 🌸`,
                      metadataPhoneId
                    );
                  } else {
                    // Update customer phone if missing, keep status as pending_whatsapp (no auto-confirm, no double stock deduction!)
                    if (!order.customerPhone || order.customerPhone.trim() === '') {
                      await order.update({ customerPhone: from });
                    }

                    console.log(`[WhatsApp Order Verified] Order ${orderCode} remains in pending_whatsapp for admin review.`);

                    await sendWhatsAppReply(
                      from,
                      `أهلاً بكِ في متجر لولو بوتيكات! 🌸\nتم استلام رسالتكِ للطلب المعتمد (${orderCode}) بنجاح. طلبكِ قيد المراجعة لدى الإدارة لتأكيد موعد التوصيل والتواصل معكِ. شكراً لتسوقكِ معنا! ✨`,
                      metadataPhoneId
                    );
                  }
                } else {
                  console.warn(`[WhatsApp Order Match] Order code ${orderCode} not found in database.`);
                }
              }
            }
          }

          // B) Native WhatsApp Catalog Order
          if (msgType === 'order') {
            const catalogOrder = msg.order;
            const items = (catalogOrder?.product_items || []).map((i) => ({
              productId: Number(i.product_retailer_id),
              quantity: Number(i.quantity) || 1,
            }));

            if (items.length > 0) {
              try {
                const draft = await orderService.createWhatsAppDraft({
                  items,
                  customerPhone: from,
                  customerName: value.contacts?.[0]?.profile?.name || 'عميل واتساب',
                  location: 'طلب مباشر من كتالوج واتساب',
                });

                console.log(`[WhatsApp Catalog Order Created] ${draft.orderCode} reserved successfully.`);

                await sendWhatsAppReply(
                  from,
                  `أهلاً بكِ! 🌸 تم استلام طلبكِ من الكتالوج وحجز المنتجات برقم معتمد (${draft.orderCode}) بإجمالي ${draft.totalCost} ₪.\nطلبكِ قيد المراجعة لدى الإدارة لتأكيد التوصيل.`,
                  metadataPhoneId
                );
              } catch (stockErr) {
                console.error('[WhatsApp Catalog Order Failed]', stockErr.message);
                await sendWhatsAppReply(
                  from,
                  `عذراً، تعذر إتمام الطلب: ${stockErr.message}`,
                  metadataPhoneId
                );
              }
            }
          }
        }
      }
    }

    // Meta strictly requires returning 200 OK immediately for all webhook deliveries
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('[WhatsApp Webhook Handler Error]', err);
    return res.status(200).send('EVENT_RECEIVED'); // Still return 200 so Meta doesn't disable webhook
  }
});

module.exports = router;
