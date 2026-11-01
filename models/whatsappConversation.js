module.exports = (sequelize, DataTypes) => sequelize.define('WhatsAppConversation', {
  phoneNumberId: { type: DataTypes.STRING(64), allowNull: false },
  customerPhone: { type: DataTypes.STRING(32), allowNull: false },
  customerName: DataTypes.STRING(160),
  displayPhoneNumber: DataTypes.STRING(32),
  lastIncomingAt: DataTypes.DATE,
  lastMessageAt: DataTypes.DATE,
  lastMessagePreview: DataTypes.STRING(250),
  unreadCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lastReadMessageId: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  automationPaused: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { indexes: [{ unique: true, fields: ['phoneNumberId', 'customerPhone'], name: 'wa_conversation_channel_customer' }] });
