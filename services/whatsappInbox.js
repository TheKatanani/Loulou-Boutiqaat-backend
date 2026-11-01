const { createWhatsAppInbox } = require('./whatsappInboxService');
module.exports = createWhatsAppInbox({ db: require('../models'), orderService: require('./orderService') });
