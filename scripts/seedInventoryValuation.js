require('dotenv').config();
const db = require('../models');

async function seedValuation() {
  await db.initPromise;
  if (!db.isConnected) {
    console.error('Database must be connected');
    process.exit(1);
  }

  console.log('Target database:', db.sequelize.config.database);

  const costMap = {
    1: 160.00, // عطر رويال عود الملكي (سعر البيع 320 -> تكلفة 160)
    2: 105.00, // عطر مسك الورد النقي (سعر البيع 210 -> تكلفة 105)
    3: 75.00,  // مجموعة أحمر شفاه (سعر البيع 150 -> تكلفة 75)
    4: 90.00,  // سيروم الهيالورونيك (سعر البيع 180 -> تكلفة 90)
    5: 225.00, // عباية حرير كريب ملكي (سعر البيع 450 -> تكلفة 225)
    6: 260.00, // ساعة نسائية ماسية (سعر البيع 520 -> تكلفة 260)
    7: 190.00, // حقيبة يد جلدية (سعر البيع 380 -> تكلفة 190)
    60107: 25.00, // Coach Space (سعر البيع 50 -> تكلفة 25)
  };

  // 1. Update Products unitCost
  for (const [id, unitCost] of Object.entries(costMap)) {
    await db.Product.update(
      { unitCost },
      { where: { id: Number(id) } }
    );
  }
  console.log('Updated Products unitCost successfully.');

  // 2. Fix order #LB-90046 snapshot
  const o90046 = await db.Order.findByPk(90046);
  if (o90046) {
    const updatedItems = [
      {
        productId: 4,
        name: 'سيروم الهيالورونيك وفيتامين سي لنضارة البشرة',
        price: 180,
        quantity: 1,
        lineTotal: 180,
        unitCost: 90.00,
        itemCOGS: 90.00,
        itemGrossProfit: 90.00,
        image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
      }
    ];
    await o90046.update({
      orders: updatedItems,
      totalPurchaseCost: 90.00,
      hasUnknownCost: false,
      costSnapshotted: true,
      deliveredAt: o90046.deliveredAt || new Date(),
    });
    console.log('Updated order #LB-90046 cost snapshot.');
  }

  // 3. Add 2 realistic delivered sample orders so profitability has variety and trends
  const existingSample = await db.Order.findOne({ where: { orderCode: '#LB-90010' } });
  if (!existingSample) {
    const sampleDate1 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    await db.Order.create({
      id: 90010,
      orderCode: '#LB-90010',
      customerName: 'سارة أحمد',
      customerPhone: '970599112233',
      location: 'رام الله - الماصيون',
      totalCost: 520.00,
      paid: 520.00,
      orderSource: 'web',
      orderStatus: 'delivered',
      status: true,
      inventoryTracked: true,
      costSnapshotted: true,
      totalPurchaseCost: 260.00,
      hasUnknownCost: false,
      deliveredAt: sampleDate1,
      orders: [
        {
          productId: 6,
          name: 'ساعة نسائية ماسية مطلية بالذهب الوردي',
          price: 520,
          quantity: 1,
          lineTotal: 520,
          unitCost: 260.00,
          itemCOGS: 260.00,
          itemGrossProfit: 260.00,
        }
      ]
    });

    const sampleDate2 = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days ago
    await db.Order.create({
      id: 90011,
      orderCode: '#LB-90011',
      customerName: 'نور الخالدي',
      customerPhone: '970598774411',
      location: 'نابلس - رفيديا',
      totalCost: 530.00,
      paid: 530.00,
      orderSource: 'whatsapp_draft',
      orderStatus: 'delivered',
      status: true,
      inventoryTracked: true,
      costSnapshotted: true,
      totalPurchaseCost: 265.00,
      hasUnknownCost: false,
      deliveredAt: sampleDate2,
      orders: [
        {
          productId: 1,
          name: 'عطر رويال عود الملكي - 100 مل',
          price: 320,
          quantity: 1,
          lineTotal: 320,
          unitCost: 160.00,
          itemCOGS: 160.00,
          itemGrossProfit: 160.00,
        },
        {
          productId: 2,
          name: 'عطر مسك الورد النقي - 75 مل',
          price: 210,
          quantity: 1,
          lineTotal: 210,
          unitCost: 105.00,
          itemCOGS: 105.00,
          itemGrossProfit: 105.00,
        }
      ]
    });
    console.log('Created sample delivered orders for rich reporting.');
  }

  console.log('Seeding completed successfully!');
  process.exit(0);
}

seedValuation().catch(e => {
  console.error('Seeding error:', e.message);
  process.exit(1);
});
