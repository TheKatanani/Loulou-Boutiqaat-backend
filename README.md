# 🛍️ Loulou Boutiqaat - Backend API (خادم متجر لولو بوتيكات)

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21.2-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Sequelize](https://img.shields.io/badge/Sequelize-v6.37-52B0E7?logo=sequelize&logoColor=white)](https://sequelize.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![JWT](https://img.shields.io/badge/JWT-Protected-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Docker](https://img.shields.io/badge/Docker%20Compose-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

الواجهة الخلفية (RESTful API) لمتجر **لولو بوتيكات (Loulou Boutiqaat)**. توفر خدمات إدارة المنتجات، التصنيفات، سلة المشتريات، المفضلة، الطلبات، وصلاحيات المستخدمين بالاعتماد على **Express.js** و **Sequelize ORM** و **MySQL**، مع توثيق أمني متكامل عبر **JWT**.

---

## ✨ الخصائص الهندسية (Key Architectural Highlights)

- 🔒 **نظام أمني متكامل (Security & Auth)**:
  - تشفير كلمات المرور باستخدام `bcryptjs`.
  - مصادقة مزدوجة (Dual-token architecture): Access Token مدته 30 دقيقة و Refresh Token مدته 10 أيام يُخزن في `HttpOnly` Cookie.
  - تحكم دقيق بالصلاحيات (RBAC - Role Based Access Control) عبر وسيطات `verifyJWT` و `verifyRoles`.
- 🗄️ **قاعدة بيانات علائقية متماسكة (Relational ORM)**:
  - نماذج Sequelize مع علاقات سليمة (`hasMany`, `belongsTo`) بين المستخدمين، المنتجات، التصنيفات، السلة، والطلبات.
  - حقول `JSON` مدعومة ومحمية من أخطاء التحليل البرمجي (Safe JSON serialization).
- 🔄 **تكامل سلس مع الزوار والعملاء**:
  - رفع وتحديث سلة المشتريات والمفضلة دفعة واحدة بعد تسجيل الدخول عبر `uploadLocalCart` و `uploadLocalSaved`.
- 🐳 **دعم كامل للحاويات (Docker & Docker Compose)**:
  - تشغيل فوري لقاعدة بيانات MySQL والخادم بضغطة زر دون الحاجة لتثبيت محلي.
- 🌱 **سكربت بذر بيانات جاهز (Data Seeder)**:
  - سكربت `pnpm seed` ينشئ الأقسام، المنتجات، كودات الدول، وروابط التواصل، وثلاثة حسابات تجريبية بكلمات مرور مشفرة.

---

## 📋 نقاط الاتصال البرمجية (API Reference)

### 1. المصادقة والجلسات (Auth)
| الطريقة | المسار | الوصف | الصلاحية المطلوبة |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | إنشاء حساب جديد وتوليد التوكن | عام للجميع |
| `POST` | `/login` | تسجيل الدخول وتعيين Cookie الجلسة | عام للجميع |
| `GET` | `/refresh` | تجديد Access Token عبر Refresh Cookie | عام |
| `POST` | `/logout` | تسجيل الخروج ومسح الجلسة | مسجل |

### 2. المنتجات والتصنيفات (Products & Categories)
| الطريقة | المسار | الوصف | الصلاحية المطلوبة |
| :--- | :--- | :--- | :--- |
| `GET` | `/product` | استرجاع المنتجات (مع فلترة بالاسم والبحث) | عام |
| `GET` | `/product/published` | استرجاع المنتجات المعروضة فقط | عام |
| `GET` | `/product/:id` | استرجاع تفاصيل منتج محدد | عام |
| `POST` | `/product` | إضافة منتج جديد | Admin, Editor |
| `PUT` | `/product/:id` | تعديل منتج | Admin, Editor |
| `DELETE` | `/product/:id` | حذف منتج | Admin |
| `GET` | `/category` | استرجاع التصنيفات | عام |
| `GET` | `/category/published`| استرجاع التصنيفات النشطة فقط | عام |
| `POST` | `/category` | إضافة قسم جديد | Admin, Editor |
| `PUT` | `/category/:id` | تعديل قسم | Admin, Editor |
| `DELETE` | `/category/:id` | حذف قسم | Admin |

### 3. السلة والمفضلة (Cart & Wishlist)
| الطريقة | المسار | الوصف | الصلاحية المطلوبة |
| :--- | :--- | :--- | :--- |
| `GET` | `/cart` | عرض سلة مشتريات المستخدم المسجل | User, Admin, Editor |
| `POST` | `/cart` | إضافة عنصر إلى السلة | User, Admin, Editor |
| `POST` | `/cart/localCart` | مزامنة سلة الزائر المحلية مع حسابه | User, Admin, Editor |
| `PUT` | `/cart/:id` | تعديل كمية المنتج في السلة (+ أو -) | User, Admin, Editor |
| `DELETE` | `/cart/:id` | إزالة منتج من السلة | User, Admin, Editor |
| `DELETE` | `/cart` | تفريغ السلة بالكامل | User, Admin, Editor |
| `GET` | `/saved` | استرجاع قائمة المفضلة | User, Admin, Editor |
| `POST` | `/saved` | إضافة منتج للمفضلة | User, Admin, Editor |
| `DELETE` | `/saved/:id` | إزالة منتج من المفضلة | User, Admin, Editor |

### 4. الطلبات (Orders)
| الطريقة | المسار | الوصف | الصلاحية المطلوبة |
| :--- | :--- | :--- | :--- |
| `GET` | `/order` | عرض جميع الطلبات | Admin, Editor |
| `POST` | `/order` | تقديم طلب جديد | User, Admin, Editor |
| `GET` | `/order/:id` | تفاصيل طلب محدد | صاحب الطلب أو الإدارة |
| `PUT` | `/order/:id` | تحديث حالة الطلب | Admin, Editor |
| `DELETE` | `/order/:id` | إلغاء أو حذف الطلب | Admin, Editor, Owner |

### 5. عام (Public & Helpers)
| الطريقة | المسار | الوصف | الصلاحية المطلوبة |
| :--- | :--- | :--- | :--- |
| `GET` | `/countryCode` | مفاتيح الاتصال المعتمدة للتسجيل | عام |
| `GET` | `/social` | روابط حسابات التواصل الاجتماعي | عام |

---

## 🚀 التشغيل والتثبيت (Installation & Running)

### الطريقة الأولى: التشغيل السريع عبر Docker (موصى بها)
```bash
# تشغيل خادم MySQL وخادم Node.js معاً بضغطة زر
docker compose up -d --build

# بذر البيانات التجريبية
docker compose exec backend node seed.js
```
سيكون الخادم متاحاً مباشرة على: `http://localhost:3500`.

---

### الطريقة الثانية: التشغيل المحلي (Local Development)

#### 1. المتطلبات:
- **Node.js** (v18+)
- **pnpm** (أو npm)
- خادم **MySQL** يعمل محلياً (XAMPP / WAMP / MySQL Server).

#### 2. ضبط المتغيرات البيئية:
أنشئ ملف `.env` مستنداً إلى `.env.example`:
```env
PORT=3500
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=loulouboutiqaat
DB_DIALECT=mysql

ACCESS_TOKEN_SECRET=your_jwt_access_secret
REFRESH_TOKEN_SECRET=your_jwt_refresh_secret
```

#### 3. تثبيت الاعتماديات:
```bash
pnpm install
```

#### 4. إنشاء وبذر قاعدة البيانات:
تأكد من إنشاء قاعدة بيانات باسم `loulouboutiqaat` في MySQL، ثم نفّذ:
```bash
pnpm seed
```

#### 5. تشغيل الخادم:
```bash
# وضع التطوير مع التحديث التلقائي
pnpm dev

# أو وضع التشغيل القياسي
pnpm start
```

---

## 🔑 الحسابات الافتراضية للاختبار (Seeded Accounts)

| الحساب | الدور | الهاتف | كلمة المرور |
| :--- | :--- | :--- | :--- |
| **Admin** | مدير كامل الصلاحيات | `+970590000001` | `Password123!` |
| **Editor** | محرر محتوى وطلبات | `+970590000002` | `Password123!` |
| **Customer** | مستخدم عادي | `+970590000003` | `Password123!` |

---

## 👨‍💻 المطور (Developer)

- **محمد قطناني (Mohammed Katanani)**
- Website: [thekatanani.com](https://thekatanani.com)
- GitHub: [@TheKatanani](https://github.com/TheKatanani)
