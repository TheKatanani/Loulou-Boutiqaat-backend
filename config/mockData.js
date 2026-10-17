const ROLES_LIST = require('./roles_list');

const mockCategories = [
  {
    id: 1,
    name: 'عطور شرقية وفاخرة',
    description: 'تشكيلة مختارة من أرقى العطور الفرنسية والشرقية والعود الفاخر',
    background: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80',
    published: true
  },
  {
    id: 2,
    name: 'مكياج وعناية بالبشرة',
    description: 'أحدث صيحات مستحضرات التجميل والعناية الفائقة بالبشرة',
    background: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
    published: true
  },
  {
    id: 3,
    name: 'عبايات وقفاطين راقية',
    description: 'تصاميم فريدة وعصرية تناسب جميع المناسبات والإطلالات اليومية',
    background: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    published: true
  },
  {
    id: 4,
    name: 'ساعات ومجوهرات',
    description: 'ساعات فاخرة ومجوهرات مطلية تضفي لمسة من الأناقة والبريق',
    background: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
    published: true
  },
  {
    id: 5,
    name: 'حقائب وإكسسوارات',
    description: 'حقائب يد جلدية راقية وإكسسوارات تكمّل أناقة إطلالتك',
    background: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    published: true
  },
  {
    id: 6,
    name: 'هدايا وتغليف فاخر',
    description: 'تنسيق وتغليف بوكسات هدايا فاخرة مع ورد ولمسات ملكية',
    background: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80',
    published: true
  }
];

const mockProducts = [
  {
    id: 1,
    name: 'عطر رويال عود الملكي - 100 مل',
    description: 'نفحات ملكية ساحرة من خشب العود المعتق والورد الدمشقي مع لمسات من العنبر الفاخر.',
    price: 320,
    prevPrice: 420,
    stars: 5,
    categoryId: 1,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 2,
    name: 'عطر مسك الورد النقي - 75 مل',
    description: 'مزيج أنثوي ناعم ومنعش من بتلات الورد والمسك الأبيض يدوم طويلاً.',
    price: 210,
    prevPrice: 280,
    stars: 5,
    categoryId: 1,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 3,
    name: 'مجموعة أحمر شفاه فيلفت مات المخملية (5 ألوان)',
    description: 'تركيبة غنية وثابتة تدوم طوال اليوم وتمنح شفتيك ملمساً مخملياً وترطيباً عميقاً.',
    price: 150,
    prevPrice: 190,
    stars: 4,
    categoryId: 2,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 4,
    name: 'سيروم الهيالورونيك وفيتامين سي لنضارة البشرة',
    description: 'سيروم علاجي مركز يعيد للبشرة حيويتها ونضارتها ويقلل من ظهور الخطوط الدقيقة.',
    price: 180,
    prevPrice: 240,
    stars: 5,
    categoryId: 2,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 5,
    name: 'عباية حرير كريب ملكي مطرزة يدوياً',
    description: 'عباية سوداء راقية مصنوعة من أجود أنواع الحرير الكريب مع تطريز يدوي دقيق على الأكمام.',
    price: 450,
    prevPrice: 600,
    stars: 5,
    categoryId: 3,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 6,
    name: 'ساعة نسائية ماسية مطلية بالذهب الوردي',
    description: 'ساعة يد فاخرة ومقاومة للماء بتصميم عصري مرصع بالزركون اللامع.',
    price: 520,
    prevPrice: 700,
    stars: 5,
    categoryId: 4,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 7,
    name: 'حقيبة يد جلدية كلاسيكية مع حزام كتف',
    description: 'حقيبة يد عملية وأنيقة من الجلد الطبيعي تتسع لجميع مقتنياتك اليومية.',
    price: 380,
    prevPrice: 490,
    stars: 4,
    categoryId: 5,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 8,
    name: 'بوكس لولو الملكي للهدايا - عطر ومكياج مع ورد فاخر',
    description: 'بوكس هدايا فخم مصمم خصيصاً للمناسبات الراقية يحتوي على عطر فرنسي ومستحضرات تجميل مختارة وتنسيق ورد راقي.',
    price: 390,
    prevPrice: 520,
    stars: 5,
    categoryId: 6,
    published: true,
    images: [
      'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80'
    ]
  }
];

const mockCountryCodes = [
  { id: 1, label: 'فلسطين (+970)', value: '+970' },
  { id: 2, label: 'فلسطين (+972)', value: '+972' },
  { id: 3, label: 'الأردن (+962)', value: '+962' },
  { id: 4, label: 'السعودية (+966)', value: '+966' },
  { id: 5, label: 'الإمارات (+971)', value: '+971' },
  { id: 6, label: 'الكويت (+965)', value: '+965' },
  { id: 7, label: 'قطر (+974)', value: '+974' },
  { id: 8, label: 'مصر (+20)', value: '+20' }
];

const mockSocial = [
  { name: 'facebook', value: 'https://facebook.com/loulou.boutiqaat' },
  { name: 'instagram', value: 'https://www.instagram.com/loulou.boutiqaat/' },
  { name: 'whatsapp', value: '972597229340' },
  { name: 'whatsApp', value: '972597229340' },
  { name: 'snapchat', value: 'https://snapchat.com/add/loulou.boutiqaat' },
  { name: 'tiktok', value: 'https://tiktok.com/@loulou.boutiqaat' }
];

const mockUsers = [
  {
    id: 1,
    name: 'مدير النظام (Admin)',
    phone: '+970590000001',
    password: 'Password123!',
    gender: 'female',
    barthDay: '1995-01-01',
    roles: { ADMIN: ROLES_LIST.ADMIN }
  },
  {
    id: 2,
    name: 'محرر المتجر (Editor)',
    phone: '+970590000002',
    password: 'Password123!',
    gender: 'female',
    barthDay: '1998-05-15',
    roles: { EDITOR: ROLES_LIST.EDITOR }
  },
  {
    id: 3,
    name: 'زبونة لولو (Customer)',
    phone: '+970590000003',
    password: 'Password123!',
    gender: 'female',
    barthDay: '2000-10-20',
    roles: { USER: ROLES_LIST.USER }
  }
];

const mockCart = [];
const mockSaved = [];
const mockOrders = [];

module.exports = {
  mockCategories,
  mockProducts,
  mockCountryCodes,
  mockSocial,
  mockUsers,
  mockCart,
  mockSaved,
  mockOrders
};
