require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./models');
const ROLES_LIST = require('./config/roles_list');

const seedData = async () => {
  try {
    console.log('Connecting to database...');
    await db.sequelize.authenticate();
    await db.sequelize.sync({ force: false });
    console.log('Database synced.');

    // 1. Seed Country Codes
    const countryCodes = [
      { label: 'فلسطين (+970)', value: '+970' },
      { label: 'فلسطين (+972)', value: '+972' },
      { label: 'الأردن (+962)', value: '+962' },
      { label: 'السعودية (+966)', value: '+966' },
      { label: 'الإمارات (+971)', value: '+971' },
      { label: 'الكويت (+965)', value: '+965' },
      { label: 'قطر (+974)', value: '+974' },
      { label: 'مصر (+20)', value: '+20' }
    ];

    for (const code of countryCodes) {
      const existing = await db.countryCode.findOne({ where: { value: code.value } });
      if (!existing) {
        await db.countryCode.create(code);
      }
    }
    console.log('Country codes seeded successfully.');

    // 2. Seed Social Links
    const socialLinks = [
      { name: 'facebook', value: 'https://facebook.com/loulou.boutiqaat' },
      { name: 'instagram', value: 'https://www.instagram.com/loulou.boutiqaat/' },
      { name: 'whatsapp', value: '972597229340' },
      { name: 'whatsApp', value: '972597229340' },
      { name: 'snapchat', value: 'https://snapchat.com/add/loulou.boutiqaat' },
      { name: 'tiktok', value: 'https://tiktok.com/@loulou.boutiqaat' }
    ];

    for (const social of socialLinks) {
      const existing = await db.social.findOne({ where: { name: social.name } });
      if (!existing) {
        await db.social.create(social);
      }
    }
    console.log('Social links seeded successfully.');

    // 3. Seed Users (Admin, Editor, Customer)
    const defaultPassword = await bcrypt.hash('Password123!', 10);
    const users = [
      {
        name: 'مدير النظام (Admin)',
        phone: '+970590000001',
        password: defaultPassword,
        gender: 'female',
        barthDay: '1995-01-01',
        roles: { ADMIN: ROLES_LIST.ADMIN }
      },
      {
        name: 'محرر المتجر (Editor)',
        phone: '+970590000002',
        password: defaultPassword,
        gender: 'female',
        barthDay: '1998-05-15',
        roles: { EDITOR: ROLES_LIST.EDITOR }
      },
      {
        name: 'زبونة لولو (Customer)',
        phone: '+970590000003',
        password: defaultPassword,
        gender: 'female',
        barthDay: '2000-10-20',
        roles: { USER: ROLES_LIST.USER }
      }
    ];

    for (const u of users) {
      const existing = await db.users.findOne({ where: { phone: u.phone } });
      if (!existing) {
        await db.users.create(u);
      }
    }
    console.log('Users seeded successfully. Password for all demo accounts: Password123!');

    // 4. Seed Categories
    const categoriesData = [
      {
        name: 'عطور شرقية وفاخرة',
        description: 'تشكيلة مختارة من أرقى العطور الفرنسية والشرقية والعود الفاخر',
        background: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80',
        published: true
      },
      {
        name: 'مكياج وعناية بالبشرة',
        description: 'أحدث صيحات مستحضرات التجميل والعناية الفائقة بالبشرة',
        background: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        published: true
      },
      {
        name: 'عبايات وقفاطين راقية',
        description: 'تصاميم فريدة وعصرية تناسب جميع المناسبات والإطلالات اليومية',
        background: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        published: true
      },
      {
        name: 'ساعات ومجوهرات',
        description: 'ساعات فاخرة ومجوهرات مطلية تضفي لمسة من الأناقة والبريق',
        background: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
        published: true
      },
      {
        name: 'حقائب وإكسسوارات',
        description: 'حقائب يد جلدية راقية وإكسسوارات تكمّل أناقة إطلالتك',
        background: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        published: true
      }
    ];

    const createdCategories = [];
    for (const cat of categoriesData) {
      let category = await db.category.findOne({ where: { name: cat.name } });
      if (!category) {
        category = await db.category.create(cat);
      }
      createdCategories.push(category);
    }
    console.log('Categories seeded successfully.');

    // 5. Seed Products
    const productsData = [
      {
        name: 'عطر رويال عود الملكي - 100 مل',
        description: 'نفحات ملكية ساحرة من خشب العود المعتق والورد الدمشقي مع لمسات من العنبر الفاخر.',
        price: 320,
        prevPrice: 420,
        stars: 5,
        categoryId: createdCategories[0].id,
        published: true,
        images: [
          'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80'
        ]
      },
      {
        name: 'عطر مسك الورد النقي - 75 مل',
        description: 'مزيج أنثوي ناعم ومنعش من بتلات الورد والمسك الأبيض يدوم طويلاً.',
        price: 210,
        prevPrice: 280,
        stars: 5,
        categoryId: createdCategories[0].id,
        published: true,
        images: [
          'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80'
        ]
      },
      {
        name: 'مجموعة أحمر شفاه فيلفت مات المخملية (5 ألوان)',
        description: 'تركيبة غنية وثابتة تدوم طوال اليوم وتمنح شفتيك ملمساً مخملياً وترطيباً عميقاً.',
        price: 150,
        prevPrice: 190,
        stars: 4,
        categoryId: createdCategories[1].id,
        published: true,
        images: [
          'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80'
        ]
      },
      {
        name: 'سيروم الهيالورونيك وفيتامين سي لنضارة البشرة',
        description: 'سيروم علاجي مركز يعيد للبشرة حيويتها ونضارتها ويقلل من ظهور الخطوط الدقيقة.',
        price: 180,
        prevPrice: 240,
        stars: 5,
        categoryId: createdCategories[1].id,
        published: true,
        images: [
          'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'
        ]
      },
      {
        name: 'عباية حرير كريب ملكي مطرزة يدوياً',
        description: 'عباية سوداء راقية مصنوعة من أجود أنواع الحرير الكريب مع تطريز يدوي دقيق على الأكمام.',
        price: 450,
        prevPrice: 600,
        stars: 5,
        categoryId: createdCategories[2].id,
        published: true,
        images: [
          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80'
        ]
      },
      {
        name: 'ساعة نسائية ماسية مطلية بالذهب الوردي',
        description: 'ساعة يد فاخرة ومقاومة للماء بتصميم عصري مرصع بالزركون اللامع.',
        price: 520,
        prevPrice: 700,
        stars: 5,
        categoryId: createdCategories[3].id,
        published: true,
        images: [
          'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80'
        ]
      },
      {
        name: 'حقيبة يد جلدية كلاسيكية مع حزام كتف قابل للإزالة',
        description: 'حقيبة يد عملية وأنيقة من الجلد الطبيعي تتسع لجميع مقتنياتك اليومية.',
        price: 380,
        prevPrice: 490,
        stars: 4,
        categoryId: createdCategories[4].id,
        published: true,
        images: [
          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80'
        ]
      }
    ];

    for (const prod of productsData) {
      const existing = await db.products.findOne({ where: { name: prod.name } });
      if (!existing) {
        await db.products.create(prod);
      }
    }
    console.log('Products seeded successfully.');

    console.log('\n=======================================');
    console.log('Database seeding finished successfully!');
    console.log('Demo Credentials:');
    console.log('Admin:    Phone: +970590000001 | Password: Password123!');
    console.log('Editor:   Phone: +970590000002 | Password: Password123!');
    console.log('Customer: Phone: +970590000003 | Password: Password123!');
    console.log('=======================================\n');
    process.exit(0);
  } catch (error) {
    console.error('Error during database seeding:', error);
    process.exit(1);
  }
};

seedData();
